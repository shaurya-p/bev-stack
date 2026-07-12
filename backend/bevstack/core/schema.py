from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class Vec3:
    x: float
    y: float
    z: float


@dataclass
class QuaternionWXYZ:
    w: float
    x: float
    y: float
    z: float


@dataclass
class Pose3D:
    translation_m: Vec3
    rotation_quat_wxyz: QuaternionWXYZ


@dataclass
class Box3D:
    center_ego_m: Vec3
    size_lwh_m: Vec3
    yaw_ego_rad: float


@dataclass
class EgoState:
    pose_global: Pose3D | None = None
    velocity_ego_mps: Vec3 | None = None


@dataclass
class CameraFrame:
    name: str
    image_uri: str
    intrinsics_3x3: list[float] | None = None
    T_ego_sensor: Pose3D | None = None


@dataclass
class LidarFrame:
    pointcloud_uri: str | None = None
    points_ego: list[Vec3] | None = None
    T_ego_sensor: Pose3D | None = None


@dataclass
class Object3D:
    object_id: str
    category: str
    box: Box3D
    source: str
    velocity_ego_mps: Vec3 | None = None
    confidence: float | None = None
    attributes: dict[str, Any] = field(default_factory=dict)


@dataclass
class MapPolygon:
    """A closed polygon map element (drivable area, crosswalk) in the ego frame.

    exterior_ego_m is a closed ring (first point == last point), meters,
    ego frame (x forward, y left, z up). holes_ego_m are interior rings.
    confidence is None for ground-truth layers, set by model layers.
    """

    element_id: str
    exterior_ego_m: list[Vec3]
    holes_ego_m: list[list[Vec3]] = field(default_factory=list)
    confidence: float | None = None


@dataclass
class MapPolyline:
    """An open polyline map element (divider, stop line, centerline) in the ego frame.

    kind carries semantic meaning only (e.g. dividers: "solid" | "dashed" |
    "road_edge"); visual style is a frontend concern keyed by layer source.
    """

    element_id: str
    points_ego_m: list[Vec3]
    kind: str | None = None
    confidence: float | None = None


@dataclass
class MapLayer:
    """One source-tagged set of static map elements, mirroring how objects carry source.

    Sources follow the "hd_map:<dataset>" / "model:<name>" convention so a
    ground-truth HD map and online map-prediction layers can coexist in a frame.
    All geometry is in the current ego frame, meters.
    """

    source: str
    drivable_areas: list[MapPolygon] = field(default_factory=list)
    lane_dividers: list[MapPolyline] = field(default_factory=list)
    crosswalks: list[MapPolygon] = field(default_factory=list)
    stop_lines: list[MapPolyline] = field(default_factory=list)
    centerlines: list[MapPolyline] = field(default_factory=list)
    attributes: dict[str, Any] = field(default_factory=dict)


@dataclass
class SceneFrame:
    frame_id: str
    timestamp_us: int
    ego: EgoState
    cameras: list[CameraFrame] = field(default_factory=list)
    lidar: LidarFrame | None = None
    objects: list[Object3D] = field(default_factory=list)
    map_layers: list[MapLayer] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    diagnostics: dict[str, Any] = field(default_factory=dict)


def to_dict(instance: Any) -> dict[str, Any]:
    """Recursively convert any schema dataclass instance to a JSON-compatible dict."""
    return asdict(instance)
