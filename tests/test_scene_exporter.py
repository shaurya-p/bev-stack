from __future__ import annotations

import json
from pathlib import Path

import pytest

from bevstack.core.schema import (
    Box3D,
    CameraFrame,
    EgoState,
    LidarFrame,
    Object3D,
    SceneFrame,
    Vec3,
)
from bevstack.export.scene_exporter import write_scene_frame_json

_CAMERA_NAMES = [
    "CAM_FRONT",
    "CAM_FRONT_LEFT",
    "CAM_FRONT_RIGHT",
    "CAM_BACK",
    "CAM_BACK_LEFT",
    "CAM_BACK_RIGHT",
]


@pytest.fixture()
def sample_frame() -> SceneFrame:
    return SceneFrame(
        frame_id="sample_frame_000",
        timestamp_us=1_620_000_000_000_000,
        ego=EgoState(velocity_ego_mps=Vec3(5.0, 0.0, 0.0)),
        cameras=[
            CameraFrame(name=name, image_uri=f"data://sample/{name.lower()}.jpg")
            for name in _CAMERA_NAMES
        ],
        lidar=LidarFrame(pointcloud_uri="data://sample/lidar_top.pcd.bin"),
        objects=[
            Object3D(
                object_id="obj_000",
                category="vehicle.car",
                box=Box3D(Vec3(15.0, 0.5, 0.9), Vec3(4.5, 2.0, 1.6), 0.05),
                source="sample",
                velocity_ego_mps=Vec3(4.2, 0.0, 0.0),
            ),
            Object3D(
                object_id="obj_001",
                category="human.pedestrian",
                box=Box3D(Vec3(5.0, 8.0, 0.9), Vec3(0.8, 0.6, 1.8), 1.57),
                source="sample",
            ),
            Object3D(
                object_id="obj_002",
                category="vehicle.bicycle",
                box=Box3D(Vec3(20.0, -3.0, 0.6), Vec3(1.8, 0.7, 1.2), 0.1),
                source="sample",
            ),
        ],
        metadata={"scene": "sample", "split": "synthetic"},
        diagnostics={"source": "synthetic", "real_data": False},
    )


def test_exporter_writes_json_file(sample_frame: SceneFrame, tmp_path: Path) -> None:
    out = tmp_path / "frame.json"
    write_scene_frame_json(sample_frame, out)
    assert out.exists()


def test_exported_json_has_expected_top_level_keys(
    sample_frame: SceneFrame, tmp_path: Path
) -> None:
    out = tmp_path / "frame.json"
    write_scene_frame_json(sample_frame, out)
    data = json.loads(out.read_text())
    assert set(data.keys()) == {
        "frame_id",
        "timestamp_us",
        "ego",
        "cameras",
        "lidar",
        "objects",
        "metadata",
        "diagnostics",
    }


def test_exported_json_has_six_cameras(sample_frame: SceneFrame, tmp_path: Path) -> None:
    out = tmp_path / "frame.json"
    write_scene_frame_json(sample_frame, out)
    data = json.loads(out.read_text())
    assert len(data["cameras"]) == 6


def test_objects_have_ego_frame_box_fields(sample_frame: SceneFrame, tmp_path: Path) -> None:
    out = tmp_path / "frame.json"
    write_scene_frame_json(sample_frame, out)
    data = json.loads(out.read_text())
    for obj in data["objects"]:
        assert "center_ego_m" in obj["box"]
        assert "yaw_ego_rad" in obj["box"]


def test_object_source_is_not_dataset_specific(
    sample_frame: SceneFrame, tmp_path: Path
) -> None:
    out = tmp_path / "frame.json"
    write_scene_frame_json(sample_frame, out)
    data = json.loads(out.read_text())
    for obj in data["objects"]:
        assert "nuscenes" not in obj["source"].lower()
        assert "waymo" not in obj["source"].lower()


def test_exporter_creates_parent_directories(
    sample_frame: SceneFrame, tmp_path: Path
) -> None:
    out = tmp_path / "a" / "b" / "frame.json"
    write_scene_frame_json(sample_frame, out)
    assert out.exists()
