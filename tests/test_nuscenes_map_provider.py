from __future__ import annotations

import logging

import numpy as np
import pytest
from pyquaternion import Quaternion

from bevstack.datasets.nuscenes.map_provider import (
    KIND_DASHED,
    KIND_ROAD_EDGE,
    KIND_SOLID,
    NuScenesMapProvider,
    divider_kind_from_segment_types,
    douglas_peucker,
    extract_lane_divider_segment_types,
    global_points_to_ego,
    simplify_ring,
    stop_line_polygon_to_segment,
)

# ---------------------------------------------------------------------------
# Douglas–Peucker simplification
# ---------------------------------------------------------------------------


def test_dp_removes_collinear_points() -> None:
    pts = np.array([[0.0, 0.0], [1.0, 0.0], [2.0, 0.0], [3.0, 0.0]])
    out = douglas_peucker(pts, tolerance_m=0.2)
    assert out.tolist() == [[0.0, 0.0], [3.0, 0.0]]


def test_dp_keeps_significant_deviation() -> None:
    pts = np.array([[0.0, 0.0], [5.0, 1.0], [10.0, 0.0]])
    out = douglas_peucker(pts, tolerance_m=0.2)
    assert out.tolist() == pts.tolist()


def test_dp_drops_sub_tolerance_deviation() -> None:
    pts = np.array([[0.0, 0.0], [5.0, 0.1], [10.0, 0.0]])
    out = douglas_peucker(pts, tolerance_m=0.2)
    assert out.tolist() == [[0.0, 0.0], [10.0, 0.0]]


def test_dp_preserves_endpoints() -> None:
    rng = np.random.default_rng(7)
    pts = np.cumsum(rng.normal(size=(50, 2)) * 0.05, axis=0)
    out = douglas_peucker(pts, tolerance_m=0.2)
    assert out[0].tolist() == pts[0].tolist()
    assert out[-1].tolist() == pts[-1].tolist()
    assert len(out) <= len(pts)


def test_dp_handles_coincident_endpoints() -> None:
    # Closed loop passed to raw DP: distance falls back to point distance.
    pts = np.array([[0.0, 0.0], [10.0, 0.0], [10.0, 10.0], [0.0, 0.0]])
    out = douglas_peucker(pts, tolerance_m=0.2)
    assert len(out) == 4  # nothing within tolerance of the degenerate segment


def test_dp_rejects_bad_shape() -> None:
    with pytest.raises(ValueError):
        douglas_peucker(np.zeros((3, 3)), tolerance_m=0.2)


def test_simplify_ring_preserves_closure() -> None:
    n = 100
    angles = np.linspace(0.0, 2.0 * np.pi, n)
    ring = np.column_stack([20.0 * np.cos(angles), 20.0 * np.sin(angles)])
    ring[-1] = ring[0]  # exactly closed, as map polygon rings are
    out = simplify_ring(ring, tolerance_m=0.2)
    assert len(out) < n
    assert out[0].tolist() == out[-1].tolist()  # still closed
    assert len(out) >= 4


def test_simplify_ring_never_degenerates() -> None:
    # A tiny triangle whose deviations are all below tolerance would collapse
    # to 2 points under raw DP; simplify_ring must return the original ring.
    ring = np.array([[0.0, 0.0], [0.1, 0.05], [0.05, 0.1], [0.0, 0.0]])
    out = simplify_ring(ring, tolerance_m=0.2)
    assert out.tolist() == ring.tolist()


# ---------------------------------------------------------------------------
# Global -> ego transform
# ---------------------------------------------------------------------------


def test_global_points_to_ego_identity_pose() -> None:
    pts = np.array([[3.0, 4.0], [-1.0, 2.0]])
    ego_t = np.array([0.0, 0.0, 0.0])
    out = global_points_to_ego(pts, ego_t, Quaternion())
    assert np.allclose(out[:, :2], pts)
    assert np.allclose(out[:, 2], 0.0)


def test_global_points_to_ego_translation_only() -> None:
    pts = np.array([[110.0, 205.0]])
    ego_t = np.array([100.0, 200.0, 1.5])
    out = global_points_to_ego(pts, ego_t, Quaternion())
    assert np.allclose(out[0], [10.0, 5.0, 0.0])


def test_global_points_to_ego_rotated_pose() -> None:
    # Ego heading 90° CCW (facing global +y). A point 10 m ahead of the ego
    # along global +y must land at ego (x=10, y=0).
    ego_t = np.array([0.0, 0.0, 0.0])
    ego_q = Quaternion(axis=[0, 0, 1], angle=np.pi / 2)
    out = global_points_to_ego(np.array([[0.0, 10.0]]), ego_t, ego_q)
    assert np.allclose(out[0], [10.0, 0.0, 0.0], atol=1e-9)
    # A point to the ego's left (global −x) lands at ego +y.
    out = global_points_to_ego(np.array([[-5.0, 0.0]]), ego_t, ego_q)
    assert np.allclose(out[0], [0.0, 5.0, 0.0], atol=1e-9)


def test_global_points_to_ego_matches_box_transform_direction() -> None:
    # Same math as adapter._global_box_to_ego: R^{-1} · (p − t).
    ego_t = np.array([50.0, -20.0, 1.0])
    ego_q = Quaternion(axis=[0, 0, 1], angle=0.7)
    p_global = np.array([[57.0, -15.0]])
    expected = ego_q.inverse.rotate(np.array([57.0, -15.0, 1.0]) - ego_t)
    out = global_points_to_ego(p_global, ego_t, ego_q)
    assert np.allclose(out[0, :2], expected[:2])
    assert out[0, 2] == 0.0


def test_global_points_to_ego_output_finite() -> None:
    rng = np.random.default_rng(3)
    pts = rng.uniform(-1000, 1000, size=(64, 2))
    out = global_points_to_ego(pts, np.array([1.0, 2.0, 3.0]), Quaternion(axis=[0, 0, 1], angle=1.1))
    assert np.isfinite(out).all()


# ---------------------------------------------------------------------------
# Divider kind mapping
# ---------------------------------------------------------------------------


def test_divider_kind_solid_and_dashed() -> None:
    assert divider_kind_from_segment_types(["SINGLE_SOLID"]) == KIND_SOLID
    assert divider_kind_from_segment_types(["SINGLE_ZIG_ZAG", "DOUBLE_DASHED_WHITE"]) == KIND_DASHED
    assert divider_kind_from_segment_types(["DOUBLE_SOLID", "SINGLE_DASHED"]) == KIND_SOLID  # tie -> solid


def test_divider_kind_fallbacks() -> None:
    assert divider_kind_from_segment_types(None) == KIND_DASHED
    assert divider_kind_from_segment_types([]) == KIND_DASHED
    assert divider_kind_from_segment_types(["MYSTERY_TYPE"]) == KIND_DASHED


def test_extract_segment_types_present() -> None:
    record = {
        "lane_divider_segments": [
            {"node_token": "a", "segment_type": "SINGLE_SOLID"},
            {"node_token": "b", "segment_type": "SINGLE_DASHED"},
        ]
    }
    assert extract_lane_divider_segment_types(record) == ["SINGLE_SOLID", "SINGLE_DASHED"]


def test_extract_segment_types_absent_or_unusable() -> None:
    assert extract_lane_divider_segment_types({}) is None
    assert extract_lane_divider_segment_types({"lane_divider_segments": []}) is None
    assert (
        extract_lane_divider_segment_types(
            {"lane_divider_segments": [{"node_token": "a"}, {"node_token": "b", "segment_type": ""}]}
        )
        is None
    )


def test_road_edge_kind_constant_is_stable() -> None:
    # Contract with the frontend theme.
    assert KIND_ROAD_EDGE == "road_edge"


# ---------------------------------------------------------------------------
# Stop-line polygon -> transverse bar segment
# ---------------------------------------------------------------------------


def _seg_sorted(seg: tuple[np.ndarray, np.ndarray]) -> np.ndarray:
    return np.array(sorted([seg[0].tolist(), seg[1].tolist()]))


def test_stop_line_axis_aligned_rectangle() -> None:
    # 8 m wide (x), 2 m deep (y): bar must run along x through y=1.
    ring = np.array([[0.0, 0.0], [8.0, 0.0], [8.0, 2.0], [0.0, 2.0], [0.0, 0.0]])
    seg = stop_line_polygon_to_segment(ring)
    assert seg is not None
    assert np.allclose(_seg_sorted(seg), [[0.0, 1.0], [8.0, 1.0]])


def test_stop_line_rotated_rectangle() -> None:
    theta = 0.6
    c, s = np.cos(theta), np.sin(theta)
    rot = np.array([[c, -s], [s, c]])
    base = np.array([[0.0, 0.0], [8.0, 0.0], [8.0, 2.0], [0.0, 2.0], [0.0, 0.0]])
    ring = base @ rot.T + np.array([100.0, 50.0])
    seg = stop_line_polygon_to_segment(ring)
    assert seg is not None
    expected = np.array([[0.0, 1.0], [8.0, 1.0]]) @ rot.T + np.array([100.0, 50.0])
    assert np.allclose(_seg_sorted(seg), np.array(sorted(expected.tolist())), atol=1e-6)


def test_stop_line_square_yields_valid_mid_segment() -> None:
    # Ambiguous orientation: any mid-segment of side length is acceptable.
    ring = np.array([[0.0, 0.0], [4.0, 0.0], [4.0, 4.0], [0.0, 4.0], [0.0, 0.0]])
    seg = stop_line_polygon_to_segment(ring)
    assert seg is not None
    length = float(np.hypot(*(seg[1] - seg[0])))
    assert length == pytest.approx(4.0)
    mid = (seg[0] + seg[1]) / 2.0
    assert np.allclose(mid, [2.0, 2.0])


def test_stop_line_non_rectangular_polygon() -> None:
    # Irregular quad: still produces a finite 2-point segment inside sane bounds.
    ring = np.array([[0.0, 0.0], [7.5, 0.4], [7.8, 2.3], [-0.2, 1.9], [0.0, 0.0]])
    seg = stop_line_polygon_to_segment(ring)
    assert seg is not None
    assert np.isfinite(np.vstack(seg)).all()
    length = float(np.hypot(*(seg[1] - seg[0])))
    assert 5.0 < length < 10.0


def test_stop_line_degenerate_returns_none() -> None:
    assert stop_line_polygon_to_segment(np.array([[0.0, 0.0], [1.0, 1.0]])) is None
    collinear = np.array([[0.0, 0.0], [1.0, 0.0], [2.0, 0.0], [0.0, 0.0]])
    assert stop_line_polygon_to_segment(collinear) is None


# ---------------------------------------------------------------------------
# Graceful degradation without map files
# ---------------------------------------------------------------------------


def test_missing_map_returns_empty_layer_and_warns(tmp_path, caplog) -> None:
    provider = NuScenesMapProvider(dataroot=tmp_path)
    with caplog.at_level(logging.WARNING):
        layer = provider.get_map_layer(
            "singapore-onenorth", np.array([0.0, 0.0, 0.0]), Quaternion()
        )
    assert layer.source == "hd_map:nuscenes"
    assert layer.drivable_areas == []
    assert layer.lane_dividers == []
    assert layer.crosswalks == []
    assert layer.stop_lines == []
    assert layer.centerlines == []
    assert any("map expansion unavailable" in r.message for r in caplog.records)

    # Second call for the same location must not warn again (cached failure).
    n_warnings = len(caplog.records)
    layer2 = provider.get_map_layer(
        "singapore-onenorth", np.array([5.0, 5.0, 0.0]), Quaternion()
    )
    assert layer2.drivable_areas == []
    assert len(caplog.records) == n_warnings
