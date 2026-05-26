from __future__ import annotations

import math
import os
from pathlib import Path

import numpy as np
import pytest
from pyquaternion import Quaternion

from bevstack.datasets.nuscenes.adapter import (
    _calibrated_sensor_to_pose3d,
    _flatten_intrinsics,
    _global_box_to_ego,
)
from bevstack.datasets.nuscenes.config import load_config

_REPO_ROOT = Path(__file__).parent.parent
_CONFIG_PATH = _REPO_ROOT / "configs" / "nuscenes_mini.yaml"


def _nuscenes_mini_available() -> bool:
    env = os.environ.get("BEV_STACK_DATASETS")
    if not env:
        return False
    base = Path(env) / "nuscenes"
    return (base / "samples").exists() and (base / "v1.0-mini").exists()


# ---------------------------------------------------------------------------
# Pure function tests — no dataset required
# ---------------------------------------------------------------------------

def test_flatten_intrinsics_row_major() -> None:
    matrix = [[800.0, 0.0, 640.0], [0.0, 800.0, 360.0], [0.0, 0.0, 1.0]]
    result = _flatten_intrinsics(matrix)
    assert len(result) == 9
    # Explicit positional check — would fail if column-major
    assert result == [800.0, 0.0, 640.0, 0.0, 800.0, 360.0, 0.0, 0.0, 1.0]
    assert result[0] == 800.0   # fx
    assert result[2] == 640.0   # cx  (principal point x is at index 2, not 6)
    assert result[4] == 800.0   # fy
    assert result[5] == 360.0   # cy


def test_calibrated_sensor_to_pose3d_maps_fields_correctly() -> None:
    # Sensor 1.5 m forward, 0.3 m left, 1.6 m up in ego frame; ~2° rotation about z.
    cs = {
        "translation": [1.5, 0.3, 1.6],
        "rotation": [0.9998477, 0.0, 0.0, 0.0174524],  # [w, x, y, z]
        "camera_intrinsic": [],
    }
    pose = _calibrated_sensor_to_pose3d(cs)
    assert pose.translation_m.x == pytest.approx(1.5)
    assert pose.translation_m.y == pytest.approx(0.3)
    assert pose.translation_m.z == pytest.approx(1.6)
    # w and z must not be swapped — would fail if rotation indices were wrong
    assert pose.rotation_quat_wxyz.w == pytest.approx(0.9998477, abs=1e-6)
    assert pose.rotation_quat_wxyz.x == pytest.approx(0.0)
    assert pose.rotation_quat_wxyz.y == pytest.approx(0.0)
    assert pose.rotation_quat_wxyz.z == pytest.approx(0.0174524, abs=1e-6)


def test_global_box_to_ego_identity_transform() -> None:
    # Ego at origin, no rotation → object position and yaw unchanged.
    identity = Quaternion(w=1.0, x=0.0, y=0.0, z=0.0)
    center, yaw = _global_box_to_ego(
        center_global=np.array([10.0, 3.0, 1.0]),
        rotation_global=identity,
        ego_translation=np.array([0.0, 0.0, 0.0]),
        ego_rotation=identity,
    )
    assert center[0] == pytest.approx(10.0)
    assert center[1] == pytest.approx(3.0)
    assert center[2] == pytest.approx(1.0)
    assert yaw == pytest.approx(0.0)


def test_global_box_to_ego_translation_only() -> None:
    # Ego at (5, 0, 0), no rotation → object shifts by exactly −5 on x.
    # Would fail if translation were added instead of subtracted, or applied after rotation.
    identity = Quaternion(w=1.0, x=0.0, y=0.0, z=0.0)
    center, _ = _global_box_to_ego(
        center_global=np.array([10.0, 3.0, 1.0]),
        rotation_global=identity,
        ego_translation=np.array([5.0, 0.0, 0.0]),
        ego_rotation=identity,
    )
    assert center[0] == pytest.approx(5.0)
    assert center[1] == pytest.approx(3.0)
    assert center[2] == pytest.approx(1.0)


def test_global_box_to_ego_rotation_90deg() -> None:
    # Ego rotated 90° CCW about z (ego x-axis now points along global y).
    # An object at global (10, 0, 0) is to ego's right → ego frame: (0, -10, 0).
    # Would fail if rotation direction were inverted or if global coords used directly.
    ego_q = Quaternion(axis=[0.0, 0.0, 1.0], angle=math.pi / 2)
    identity = Quaternion(w=1.0, x=0.0, y=0.0, z=0.0)
    center, _ = _global_box_to_ego(
        center_global=np.array([10.0, 0.0, 0.0]),
        rotation_global=identity,
        ego_translation=np.array([0.0, 0.0, 0.0]),
        ego_rotation=ego_q,
    )
    assert center[0] == pytest.approx(0.0, abs=1e-10)
    assert center[1] == pytest.approx(-10.0, abs=1e-10)
    assert center[2] == pytest.approx(0.0, abs=1e-10)


def test_global_box_yaw_relative_to_ego() -> None:
    # Ego rotated 45° CCW about z. Object faces global x (yaw=0 in global).
    # Relative to ego, object heading = −π/4.
    # Would fail if yaw composition were inverted (would give +π/4).
    ego_q = Quaternion(axis=[0.0, 0.0, 1.0], angle=math.pi / 4)
    identity = Quaternion(w=1.0, x=0.0, y=0.0, z=0.0)
    _, yaw_ego = _global_box_to_ego(
        center_global=np.array([0.0, 0.0, 0.0]),
        rotation_global=identity,
        ego_translation=np.array([0.0, 0.0, 0.0]),
        ego_rotation=ego_q,
    )
    assert yaw_ego == pytest.approx(-math.pi / 4, abs=1e-10)


def test_nuscenes_config_loads_all_fields() -> None:
    config = load_config(_CONFIG_PATH)
    assert config.dataset == "nuscenes"
    assert config.version == "v1.0-mini"
    assert config.dataroot_env == "BEV_STACK_DATASETS"
    assert config.relative_dataroot == "nuscenes"
    assert config.split == "mini"


# ---------------------------------------------------------------------------
# Integration test — skipped unless nuScenes mini is present
# ---------------------------------------------------------------------------

@pytest.mark.skipif(
    not _nuscenes_mini_available(),
    reason=(
        "nuScenes mini not available — set BEV_STACK_DATASETS and extract the dataset. "
        "Required: $BEV_STACK_DATASETS/nuscenes/samples and $BEV_STACK_DATASETS/nuscenes/v1.0-mini"
    ),
)
def test_first_sample_exports_valid_scene_frame() -> None:
    from nuscenes.nuscenes import NuScenes

    from bevstack.datasets.nuscenes.adapter import sample_to_scene_frame
    from bevstack.datasets.nuscenes.paths import (
        get_dataset_root_from_env,
        resolve_nuscenes_dataroot,
    )

    dataroot = resolve_nuscenes_dataroot(get_dataset_root_from_env())
    nusc = NuScenes(version="v1.0-mini", dataroot=str(dataroot), verbose=False)
    sample = nusc.sample[0]
    frame = sample_to_scene_frame(nusc, sample["token"], dataroot)

    assert frame.frame_id == sample["token"]
    assert frame.timestamp_us == int(sample["timestamp"])
    assert len(frame.cameras) == 6
    assert frame.lidar is not None
    assert len(frame.objects) > 0

    for obj in frame.objects:
        assert obj.source == "nuscenes_gt"
        assert obj.confidence is None
        assert hasattr(obj.box, "center_ego_m")
        assert hasattr(obj.box, "yaw_ego_rad")
        # If global coords leaked in, distances would be ~UTM scale (100,000+ m).
        dist = (obj.box.center_ego_m.x ** 2 + obj.box.center_ego_m.y ** 2) ** 0.5
        assert dist < 200.0, f"Object center suspiciously far from ego: {dist:.1f} m"
