from __future__ import annotations

import dataclasses
import json

from bevstack.core.schema import (
    Box3D,
    EgoState,
    Object3D,
    Pose3D,
    QuaternionWXYZ,
    SceneFrame,
    Vec3,
    to_dict,
)

# Contract: frontend/src/schema/sceneFrame.ts mirrors these field names exactly.
# Update the TypeScript file and this set together whenever SceneFrame fields change.
_EXPECTED_SCENE_FRAME_FIELDS = frozenset({
    "frame_id",
    "timestamp_us",
    "ego",
    "cameras",
    "lidar",
    "objects",
    "metadata",
    "diagnostics",
})


def _minimal_frame() -> SceneFrame:
    return SceneFrame(
        frame_id="frame_001",
        timestamp_us=1_620_000_000_000_000,
        ego=EgoState(),
    )


def test_minimal_scene_frame_construction() -> None:
    frame = _minimal_frame()
    assert frame.frame_id == "frame_001"
    assert frame.timestamp_us == 1_620_000_000_000_000
    assert frame.cameras == []
    assert frame.lidar is None
    assert frame.objects == []
    assert frame.metadata == {}
    assert frame.diagnostics == {}


def test_scene_frame_serialization_to_dict() -> None:
    frame = _minimal_frame()
    d = to_dict(frame)
    assert isinstance(d, dict)
    assert d["frame_id"] == "frame_001"
    assert d["timestamp_us"] == 1_620_000_000_000_000
    assert d["cameras"] == []
    assert d["lidar"] is None
    assert d["objects"] == []
    assert d["ego"] == {"pose_global": None, "velocity_ego_mps": None}


def test_scene_frame_json_serializable() -> None:
    frame = _minimal_frame()
    serialized = json.dumps(to_dict(frame))
    loaded = json.loads(serialized)
    assert loaded["frame_id"] == "frame_001"
    assert loaded["ego"]["pose_global"] is None


def test_object3d_nullable_velocity_and_confidence() -> None:
    obj = Object3D(
        object_id="obj_001",
        category="vehicle.car",
        box=Box3D(
            center_ego_m=Vec3(x=10.0, y=2.0, z=0.5),
            size_lwh_m=Vec3(x=4.5, y=2.0, z=1.6),
            yaw_ego_rad=0.0,
        ),
        source="gt",
        velocity_ego_mps=None,
        confidence=None,
    )
    assert obj.velocity_ego_mps is None
    assert obj.confidence is None
    d = to_dict(obj)
    assert d["velocity_ego_mps"] is None
    assert d["confidence"] is None


def test_box3d_uses_ego_frame_field_names() -> None:
    box = Box3D(
        center_ego_m=Vec3(1.0, 2.0, 3.0),
        size_lwh_m=Vec3(4.0, 2.0, 1.5),
        yaw_ego_rad=1.57,
    )
    d = to_dict(box)
    assert "center_ego_m" in d
    assert "size_lwh_m" in d
    assert "yaw_ego_rad" in d
    # Ensure bare names without the ego-frame suffix are not present
    assert "center" not in d
    assert "yaw" not in d


def test_object3d_source_not_hardcoded_to_gt() -> None:
    sources = ["gt", "detector:centerpoint", "tracker:kalman_v1", "fusion_model:bevfusion"]
    for src in sources:
        obj = Object3D(
            object_id="x",
            category="vehicle.car",
            box=Box3D(Vec3(0.0, 0.0, 0.0), Vec3(1.0, 1.0, 1.0), 0.0),
            source=src,
        )
        assert obj.source == src


def test_typescript_schema_field_alignment() -> None:
    actual_fields = frozenset(f.name for f in dataclasses.fields(SceneFrame))
    assert actual_fields == _EXPECTED_SCENE_FRAME_FIELDS, (
        "SceneFrame fields changed — update frontend/src/schema/sceneFrame.ts and "
        "_EXPECTED_SCENE_FRAME_FIELDS together. "
        f"Added: {actual_fields - _EXPECTED_SCENE_FRAME_FIELDS}, "
        f"Removed: {_EXPECTED_SCENE_FRAME_FIELDS - actual_fields}"
    )
