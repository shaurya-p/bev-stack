from __future__ import annotations

from bevstack.core.validation import validate_scene_frame_dict


def _valid_frame() -> dict:
    return {
        "frame_id": "test_frame_000",
        "timestamp_us": 1_620_000_000_000_000,
        "ego": {"pose_global": None, "velocity_ego_mps": None},
        "cameras": [{"name": "CAM_FRONT", "image_uri": "data://cam.jpg"}],
        "lidar": None,
        "objects": [
            {
                "object_id": "obj_0",
                "category": "vehicle.car",
                "source": "gt",
                "box": {
                    "center_ego_m": {"x": 10.0, "y": 2.0, "z": 0.5},
                    "size_lwh_m": {"x": 4.5, "y": 2.0, "z": 1.6},
                    "yaw_ego_rad": 0.1,
                },
                "velocity_ego_mps": None,
                "confidence": None,
                "attributes": {},
            }
        ],
        "metadata": {"scene": "test"},
        "diagnostics": {"ok": True},
    }


def test_valid_frame_returns_no_issues() -> None:
    assert validate_scene_frame_dict(_valid_frame()) == []


def test_missing_required_field_is_reported() -> None:
    data = _valid_frame()
    del data["frame_id"]
    issues = validate_scene_frame_dict(data)
    assert any("frame_id" in issue for issue in issues)


def test_non_list_cameras_is_reported() -> None:
    data = _valid_frame()
    data["cameras"] = {"bad": "value"}
    issues = validate_scene_frame_dict(data)
    assert any("cameras" in issue for issue in issues)


def test_non_list_objects_is_reported() -> None:
    data = _valid_frame()
    data["objects"] = "not a list"
    issues = validate_scene_frame_dict(data)
    assert any("objects" in issue for issue in issues)


def test_missing_object_box_ego_field_is_reported() -> None:
    data = _valid_frame()
    del data["objects"][0]["box"]["center_ego_m"]
    issues = validate_scene_frame_dict(data)
    assert any("center_ego_m" in issue for issue in issues)


def test_non_finite_center_values_are_reported() -> None:
    data = _valid_frame()
    data["objects"][0]["box"]["center_ego_m"]["x"] = float("inf")
    issues = validate_scene_frame_dict(data)
    assert any("center_ego_m" in issue and ".x" in issue for issue in issues)


def test_negative_object_size_is_reported() -> None:
    data = _valid_frame()
    data["objects"][0]["box"]["size_lwh_m"]["x"] = -1.0
    issues = validate_scene_frame_dict(data)
    assert any("size_lwh_m" in issue and ".x" in issue for issue in issues)


def test_large_distance_triggers_warning() -> None:
    # Object center at 1000 m — simulates accidentally exporting global-frame coordinates.
    data = _valid_frame()
    data["objects"][0]["box"]["center_ego_m"]["x"] = 1000.0
    issues = validate_scene_frame_dict(data)
    warnings = [i for i in issues if i.startswith("WARNING:")]
    assert warnings, "expected a WARNING for object center far from ego"
    assert any("1000" in w or "1000." in w for w in warnings)
