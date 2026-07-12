"""nuScenes HD-map provider: vector map expansion -> ego-frame MapLayer.

All nuScenes map-expansion specifics live here. Output is a source-agnostic
MapLayer (source="hd_map:nuscenes") with geometry in the current ego frame
(x forward, y left, z up), meters, z=0 for all map elements.

Transform direction: global (map) -> ego, matching the box transform in
adapter.py:  p_ego = R_ego^{-1} · (p_global − t_ego).

Pure helpers at the top of this module are testable without the dataset.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import numpy as np
from pyquaternion import Quaternion

from bevstack.core.schema import MapLayer, MapPolygon, MapPolyline, Vec3

logger = logging.getLogger(__name__)

MAP_SOURCE = "hd_map:nuscenes"

# Simplification tolerance for exported map geometry, meters.
SIMPLIFY_TOLERANCE_M = 0.2

# Divider kinds are a semantic contract with the frontend theme.
KIND_SOLID = "solid"
KIND_DASHED = "dashed"
KIND_ROAD_EDGE = "road_edge"


# ---------------------------------------------------------------------------
# Pure helpers — no NuScenesMap object, fully testable in isolation
# ---------------------------------------------------------------------------

def douglas_peucker(points: np.ndarray, tolerance_m: float) -> np.ndarray:
    """Simplify an (N, 2) polyline with Douglas–Peucker, preserving endpoints.

    For closed rings (first point == last point) the shared endpoint is kept,
    so ring closure is preserved. Returns at least the two endpoints.
    """
    pts = np.asarray(points, dtype=float)
    if pts.ndim != 2 or pts.shape[1] != 2:
        raise ValueError(f"expected (N, 2) points, got shape {pts.shape}")
    n = len(pts)
    if n <= 2:
        return pts.copy()

    keep = np.zeros(n, dtype=bool)
    keep[0] = keep[-1] = True
    # Iterative stack-based DP to avoid recursion limits on long boundaries.
    stack = [(0, n - 1)]
    while stack:
        first, last = stack.pop()
        if last - first < 2:
            continue
        start, end = pts[first], pts[last]
        seg = end - start
        seg_len = float(np.hypot(seg[0], seg[1]))
        mid = pts[first + 1 : last]
        if seg_len == 0.0:
            dists = np.hypot(mid[:, 0] - start[0], mid[:, 1] - start[1])
        else:
            # Perpendicular distance to the segment's supporting line.
            dists = np.abs(np.cross(seg, mid - start)) / seg_len
        idx = int(np.argmax(dists))
        if dists[idx] > tolerance_m:
            split = first + 1 + idx
            keep[split] = True
            stack.append((first, split))
            stack.append((split, last))
    return pts[keep]


def simplify_ring(ring: np.ndarray, tolerance_m: float) -> np.ndarray:
    """Simplify a closed ring (first == last), preserving closure.

    Returns the ring unchanged if simplification would degenerate it
    (fewer than 4 points including the closing point).
    """
    out = douglas_peucker(ring, tolerance_m)
    if len(out) < 4:
        return np.asarray(ring, dtype=float).copy()
    return out


def global_points_to_ego(
    points_global_xy: np.ndarray,
    ego_translation: np.ndarray,
    ego_rotation: Quaternion,
) -> np.ndarray:
    """Transform (N, 2) global-frame map points into (N, 3) ego-frame points, z=0.

    Transform direction: global -> ego, p_ego = R_ego^{-1} · (p_global − t_ego).
    Map geometry is 2D; global z is taken as the ego origin height so the
    result lies in the ego ground plane (z=0).
    """
    pts = np.asarray(points_global_xy, dtype=float)
    if pts.ndim != 2 or pts.shape[1] != 2:
        raise ValueError(f"expected (N, 2) points, got shape {pts.shape}")
    n = len(pts)
    pts3 = np.column_stack([pts, np.full(n, float(ego_translation[2]))])
    rot = ego_rotation.inverse.rotation_matrix
    ego = (pts3 - np.asarray(ego_translation, dtype=float)) @ rot.T
    ego[:, 2] = 0.0
    return ego


def divider_kind_from_segment_types(segment_types: list[str] | None) -> str:
    """Map nuScenes lane_divider segment types to a semantic kind.

    Majority vote over segments; SOLID beats DASHED on ties. Falls back to
    "dashed" when segment types are absent or unrecognized.
    """
    if not segment_types:
        return KIND_DASHED
    solid = sum(1 for s in segment_types if "SOLID" in s.upper())
    dashed = sum(1 for s in segment_types if "DASH" in s.upper())
    if solid == 0 and dashed == 0:
        return KIND_DASHED
    return KIND_SOLID if solid >= dashed else KIND_DASHED


def extract_lane_divider_segment_types(record: dict[str, Any]) -> list[str] | None:
    """Pull segment_type strings from a lane_divider record, or None if absent.

    nuScenes map expansion stores these under "lane_divider_segments":
    [{"node_token": ..., "segment_type": "SINGLE_SOLID" | "DOUBLE_DASHED" | ...}].
    Returns None when the field is missing or carries no usable types, so the
    caller can fall back to an honest heuristic instead of guessing.
    """
    segments = record.get("lane_divider_segments")
    if not isinstance(segments, list) or not segments:
        return None
    types = [
        s["segment_type"]
        for s in segments
        if isinstance(s, dict) and isinstance(s.get("segment_type"), str) and s["segment_type"]
    ]
    return types or None


def stop_line_polygon_to_segment(
    ring_xy: np.ndarray,
) -> tuple[np.ndarray, np.ndarray] | None:
    """Collapse a stop-line polygon to its transverse bar segment.

    nuScenes models stop lines as painted-box polygons. The semantic stop line
    is the bar across the lane: the segment connecting the midpoints of the two
    short edges of the polygon's minimum rotated rectangle (i.e. the rectangle's
    long axis through its center). Returns (p0, p1) as (2,) xy arrays, or None
    for degenerate inputs (fewer than 3 distinct points or zero area).
    """
    from shapely.geometry import Polygon

    pts = np.asarray(ring_xy, dtype=float)
    if pts.ndim != 2 or pts.shape[1] != 2 or len(np.unique(pts, axis=0)) < 3:
        return None
    poly = Polygon(pts)
    if not poly.is_valid or poly.area <= 0.0:
        return None
    rect = poly.minimum_rotated_rectangle
    if rect.geom_type != "Polygon":
        return None
    c = np.asarray(rect.exterior.coords)[:4]  # 4 corners (5th closes the ring)
    e01 = float(np.hypot(*(c[1] - c[0])))
    e12 = float(np.hypot(*(c[2] - c[1])))
    if e01 <= e12:
        # c0-c1 and c2-c3 are the short edges; bar joins their midpoints.
        return (c[0] + c[1]) / 2.0, (c[2] + c[3]) / 2.0
    return (c[1] + c[2]) / 2.0, (c[3] + c[0]) / 2.0


def points_to_vec3(points_ego: np.ndarray) -> list[Vec3]:
    return [Vec3(x=float(p[0]), y=float(p[1]), z=float(p[2])) for p in points_ego]


def _ring_to_ego_vec3(
    coords_xy: np.ndarray,
    ego_translation: np.ndarray,
    ego_rotation: Quaternion,
) -> list[Vec3]:
    simplified = simplify_ring(coords_xy, SIMPLIFY_TOLERANCE_M)
    return points_to_vec3(global_points_to_ego(simplified, ego_translation, ego_rotation))


def _line_to_ego_vec3(
    coords_xy: np.ndarray,
    ego_translation: np.ndarray,
    ego_rotation: Quaternion,
) -> list[Vec3]:
    simplified = douglas_peucker(coords_xy, SIMPLIFY_TOLERANCE_M)
    return points_to_vec3(global_points_to_ego(simplified, ego_translation, ego_rotation))


# ---------------------------------------------------------------------------
# Provider — requires the nuScenes map expansion on disk
# ---------------------------------------------------------------------------

class NuScenesMapProvider:
    """Extracts an ego-centered patch of the nuScenes vector map as a MapLayer.

    Lazily loads one NuScenesMap per map location and caches it. If the map
    expansion files are missing, extraction degrades to an empty MapLayer with
    a single logged warning per location — it never raises for missing files.
    """

    def __init__(self, dataroot: Path, patch_radius_m: float = 80.0) -> None:
        self._dataroot = Path(dataroot)
        self._patch_radius_m = float(patch_radius_m)
        self._maps: dict[str, Any] = {}  # location -> NuScenesMap | None (load failed)
        self._divider_kind_path_logged = False

    def _get_map(self, location: str) -> Any | None:
        if location in self._maps:
            return self._maps[location]
        try:
            from nuscenes.map_expansion.map_api import NuScenesMap

            nusc_map = NuScenesMap(dataroot=str(self._dataroot), map_name=location)
        except Exception as e:  # missing expansion files, unknown location, ...
            logger.warning(
                "nuScenes map expansion unavailable for location %r (%s); "
                "map layers will be empty for this location.",
                location,
                e,
            )
            nusc_map = None
        self._maps[location] = nusc_map
        return nusc_map

    def _log_divider_kind_path(self, used_segment_types: bool) -> None:
        if self._divider_kind_path_logged:
            return
        self._divider_kind_path_logged = True
        if used_segment_types:
            logger.info(
                "lane_divider kind: derived from lane_divider_segments segment_type."
            )
        else:
            logger.info(
                "lane_divider kind: segment_type not present in records; using "
                "heuristic fallback (lane_divider -> dashed, road_divider -> road_edge)."
            )

    def get_map_layer(
        self,
        location: str,
        ego_translation: np.ndarray,
        ego_rotation: Quaternion,
    ) -> MapLayer:
        """Extract the map patch around the ego pose as an ego-frame MapLayer.

        ego_translation / ego_rotation encode the ego pose in the global frame
        (values from the nuScenes ego_pose record), same convention as the box
        transform in adapter.py.
        """
        layer = MapLayer(
            source=MAP_SOURCE,
            attributes={
                "map_location": location,
                "patch_radius_m": self._patch_radius_m,
            },
        )
        nusc_map = self._get_map(location)
        if nusc_map is None:
            return layer

        from shapely.geometry import LineString, MultiLineString, MultiPolygon, Polygon, box

        ex, ey = float(ego_translation[0]), float(ego_translation[1])
        r = self._patch_radius_m
        patch = box(ex - r, ey - r, ex + r, ey + r)
        patch_coords = (ex - r, ey - r, ex + r, ey + r)

        records = nusc_map.get_records_in_patch(
            patch_coords,
            layer_names=[
                "drivable_area",
                "ped_crossing",
                "stop_line",
                "lane_divider",
                "road_divider",
                "lane",
                "lane_connector",
            ],
            mode="intersect",
        )

        def clipped_polygons(geom: Polygon) -> list[Polygon]:
            clipped = geom.intersection(patch)
            if clipped.is_empty:
                return []
            if isinstance(clipped, Polygon):
                return [clipped]
            if isinstance(clipped, MultiPolygon):
                return list(clipped.geoms)
            return []  # degenerate intersection (line/point): drop

        def clipped_lines(geom: LineString) -> list[LineString]:
            clipped = geom.intersection(patch)
            if clipped.is_empty:
                return []
            if isinstance(clipped, LineString):
                return [clipped]
            if isinstance(clipped, MultiLineString):
                return list(clipped.geoms)
            return []

        def add_polygon(target: list[MapPolygon], element_id: str, poly: Polygon) -> None:
            exterior = _ring_to_ego_vec3(
                np.asarray(poly.exterior.coords)[:, :2], ego_translation, ego_rotation
            )
            holes = [
                _ring_to_ego_vec3(
                    np.asarray(hole.coords)[:, :2], ego_translation, ego_rotation
                )
                for hole in poly.interiors
            ]
            target.append(
                MapPolygon(element_id=element_id, exterior_ego_m=exterior, holes_ego_m=holes)
            )

        # Drivable areas: each record owns multiple polygons; clip each to the patch.
        for token in records.get("drivable_area", []):
            record = nusc_map.get("drivable_area", token)
            for i, polygon_token in enumerate(record["polygon_tokens"]):
                poly = nusc_map.extract_polygon(polygon_token)
                if not poly.is_valid or poly.is_empty:
                    continue
                for j, clipped in enumerate(clipped_polygons(poly)):
                    add_polygon(layer.drivable_areas, f"{token}:{i}:{j}", clipped)

        # Crosswalks.
        for token in records.get("ped_crossing", []):
            record = nusc_map.get("ped_crossing", token)
            poly = nusc_map.extract_polygon(record["polygon_token"])
            if not poly.is_valid or poly.is_empty:
                continue
            for j, clipped in enumerate(clipped_polygons(poly)):
                add_polygon(layer.crosswalks, f"{token}:{j}", clipped)

        # Stop lines are painted-box polygons in nuScenes; collapse each to its
        # transverse bar segment (2 points) so it renders as an actual stop line.
        for token in records.get("stop_line", []):
            record = nusc_map.get("stop_line", token)
            poly = nusc_map.extract_polygon(record["polygon_token"])
            if not poly.is_valid or poly.is_empty:
                continue
            for j, clipped in enumerate(clipped_polygons(poly)):
                segment = stop_line_polygon_to_segment(
                    np.asarray(clipped.exterior.coords)[:, :2]
                )
                if segment is None:
                    logger.debug("stop_line %s:%d degenerate after clipping; skipped", token, j)
                    continue
                pts = points_to_vec3(
                    global_points_to_ego(np.vstack(segment), ego_translation, ego_rotation)
                )
                layer.stop_lines.append(
                    MapPolyline(element_id=f"{token}:{j}", points_ego_m=pts)
                )

        # Lane dividers: prefer real segment types, fall back to the honest heuristic.
        used_segment_types = False
        for token in records.get("lane_divider", []):
            record = nusc_map.get("lane_divider", token)
            segment_types = extract_lane_divider_segment_types(record)
            if segment_types is not None:
                used_segment_types = True
                kind = divider_kind_from_segment_types(segment_types)
            else:
                kind = KIND_DASHED
            line = nusc_map.extract_line(record["line_token"])
            if line.is_empty:
                continue
            for j, clipped in enumerate(clipped_lines(line)):
                pts = _line_to_ego_vec3(
                    np.asarray(clipped.coords)[:, :2], ego_translation, ego_rotation
                )
                layer.lane_dividers.append(
                    MapPolyline(element_id=f"{token}:{j}", points_ego_m=pts, kind=kind)
                )
        if records.get("lane_divider"):
            self._log_divider_kind_path(used_segment_types)

        # Road dividers carry no per-segment styling; treat as road edges.
        for token in records.get("road_divider", []):
            record = nusc_map.get("road_divider", token)
            line = nusc_map.extract_line(record["line_token"])
            if line.is_empty:
                continue
            for j, clipped in enumerate(clipped_lines(line)):
                pts = _line_to_ego_vec3(
                    np.asarray(clipped.coords)[:, :2], ego_translation, ego_rotation
                )
                layer.lane_dividers.append(
                    MapPolyline(element_id=f"{token}:{j}", points_ego_m=pts, kind=KIND_ROAD_EDGE)
                )

        # Lane centerlines: discretized arcline paths, clipped to the patch.
        lane_tokens = list(records.get("lane", [])) + list(records.get("lane_connector", []))
        if lane_tokens:
            discretized = nusc_map.discretize_lanes(lane_tokens, resolution_meters=1.0)
            for token, poses in discretized.items():
                if len(poses) < 2:
                    continue
                line = LineString([(p[0], p[1]) for p in poses])
                for j, clipped in enumerate(clipped_lines(line)):
                    pts = _line_to_ego_vec3(
                        np.asarray(clipped.coords)[:, :2], ego_translation, ego_rotation
                    )
                    layer.centerlines.append(
                        MapPolyline(element_id=f"{token}:{j}", points_ego_m=pts)
                    )

        return layer
