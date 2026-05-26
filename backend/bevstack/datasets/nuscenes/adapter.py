from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
from nuscenes.nuscenes import NuScenes
from pyquaternion import Quaternion

from bevstack.core.schema import (
    Box3D,
    CameraFrame,
    EgoState,
    LidarFrame,
    Object3D,
    Pose3D,
    QuaternionWXYZ,
    SceneFrame,
    Vec3,
)

_CAMERA_CHANNELS = [
    "CAM_FRONT",
    "CAM_FRONT_LEFT",
    "CAM_FRONT_RIGHT",
    "CAM_BACK",
    "CAM_BACK_LEFT",
    "CAM_BACK_RIGHT",
]
_LIDAR_CHANNEL = "LIDAR_TOP"


# ---------------------------------------------------------------------------
# Pure helpers — no NuScenes object, fully testable in isolation
# ---------------------------------------------------------------------------

def _quat_to_wxyz(q: Quaternion) -> QuaternionWXYZ:
    return QuaternionWXYZ(w=float(q.w), x=float(q.x), y=float(q.y), z=float(q.z))


def _vec3(arr: Any) -> Vec3:
    return Vec3(x=float(arr[0]), y=float(arr[1]), z=float(arr[2]))


def _calibrated_sensor_to_pose3d(cs_record: dict) -> Pose3D:
    """Convert a nuScenes calibrated_sensor record to Pose3D (sensor → ego).

    The record's translation and rotation are expressed directly in the ego frame.
    """
    return Pose3D(
        translation_m=_vec3(cs_record["translation"]),
        rotation_quat_wxyz=_quat_to_wxyz(Quaternion(cs_record["rotation"])),
    )


def _flatten_intrinsics(camera_intrinsic: list[list[float]]) -> list[float]:
    """Flatten a 3×3 camera intrinsics matrix to 9 floats, row-major."""
    return [float(v) for row in camera_intrinsic for v in row]


def _global_box_to_ego(
    center_global: np.ndarray,
    rotation_global: Quaternion,
    ego_translation: np.ndarray,
    ego_rotation: Quaternion,
) -> tuple[np.ndarray, float]:
    """Transform a 3D box center and heading from global frame into ego frame.

    Transform direction: global → ego
      center_ego   = R_ego^{-1} · (center_global − t_ego)
      rotation_ego = q_ego^{-1} ⊗ rotation_global
      yaw_ego      = rotation_ego.yaw_pitch_roll[0]  (rotation about z in x-y plane)

    ego_translation / ego_rotation encode the ego pose in the global frame
    (values from the nuScenes ego_pose record for this sample).
    """
    center_ego = ego_rotation.inverse.rotate(center_global - ego_translation)
    rotation_ego = ego_rotation.inverse * rotation_global
    yaw_ego = float(rotation_ego.yaw_pitch_roll[0])
    return center_ego, yaw_ego


# ---------------------------------------------------------------------------
# Builders — require a live NuScenes object
# ---------------------------------------------------------------------------

def _build_camera_frame(
    nusc: NuScenes,
    sample: dict,
    channel: str,
    dataroot: Path,
) -> CameraFrame:
    sd = nusc.get("sample_data", sample["data"][channel])
    cs = nusc.get("calibrated_sensor", sd["calibrated_sensor_token"])
    intrinsics = (
        _flatten_intrinsics(cs["camera_intrinsic"])
        if cs.get("camera_intrinsic")
        else None
    )
    return CameraFrame(
        name=channel,
        image_uri=str(dataroot / sd["filename"]),
        intrinsics_3x3=intrinsics,
        T_ego_sensor=_calibrated_sensor_to_pose3d(cs),
    )


def _build_lidar_frame(
    nusc: NuScenes,
    sample: dict,
    dataroot: Path,
) -> LidarFrame | None:
    if _LIDAR_CHANNEL not in sample["data"]:
        return None
    sd = nusc.get("sample_data", sample["data"][_LIDAR_CHANNEL])
    cs = nusc.get("calibrated_sensor", sd["calibrated_sensor_token"])
    return LidarFrame(
        pointcloud_uri=str(dataroot / sd["filename"]),
        points_ego=None,
        T_ego_sensor=_calibrated_sensor_to_pose3d(cs),
    )


def _build_ego_state(ego_pose: dict) -> EgoState:
    return EgoState(
        pose_global=Pose3D(
            translation_m=_vec3(ego_pose["translation"]),
            rotation_quat_wxyz=_quat_to_wxyz(Quaternion(ego_pose["rotation"])),
        ),
        velocity_ego_mps=None,
    )


def _annotation_to_object3d(
    nusc: NuScenes,
    ann_token: str,
    ego_translation: np.ndarray,
    ego_rotation: Quaternion,
) -> Object3D:
    ann = nusc.get("sample_annotation", ann_token)

    center_global = np.array(ann["translation"])
    rotation_global = Quaternion(ann["rotation"])
    center_ego, yaw_ego = _global_box_to_ego(
        center_global, rotation_global, ego_translation, ego_rotation
    )

    # nuScenes size is [width, length, height]; our size_lwh_m is Vec3(x=l, y=w, z=h).
    w, l, h = ann["size"]

    instance = nusc.get("instance", ann["instance_token"])
    category_name = nusc.get("category", instance["category_token"])["name"]
    attr_names = [nusc.get("attribute", t)["name"] for t in ann["attribute_tokens"]]

    return Object3D(
        object_id=ann["instance_token"],
        category=category_name,
        box=Box3D(
            center_ego_m=_vec3(center_ego),
            size_lwh_m=Vec3(x=float(l), y=float(w), z=float(h)),
            yaw_ego_rad=yaw_ego,
        ),
        source="nuscenes_gt",
        velocity_ego_mps=None,
        confidence=None,
        attributes={
            "num_lidar_pts": ann.get("num_lidar_pts", -1),
            "num_radar_pts": ann.get("num_radar_pts", -1),
            "visibility_token": ann.get("visibility_token", ""),
            "attributes": attr_names,
        },
    )


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def sample_to_scene_frame(
    nusc: NuScenes,
    sample_token: str,
    dataroot: Path,
) -> SceneFrame:
    """Convert one nuScenes sample into a SceneFrame.

    All object geometry is expressed in the current ego frame (x forward, y left,
    z up). The LIDAR_TOP ego pose is used as the canonical reference frame for
    this sample. Dataset-specific transforms are confined to this module.
    """
    sample = nusc.get("sample", sample_token)

    # LIDAR_TOP ego pose is the canonical reference for this sample's ego frame.
    lidar_sd = nusc.get("sample_data", sample["data"][_LIDAR_CHANNEL])
    ego_pose = nusc.get("ego_pose", lidar_sd["ego_pose_token"])
    ego_translation = np.array(ego_pose["translation"])
    ego_rotation = Quaternion(ego_pose["rotation"])

    cameras = [
        _build_camera_frame(nusc, sample, ch, dataroot)
        for ch in _CAMERA_CHANNELS
        if ch in sample["data"]
    ]
    lidar = _build_lidar_frame(nusc, sample, dataroot)
    objects = [
        _annotation_to_object3d(nusc, t, ego_translation, ego_rotation)
        for t in sample["anns"]
    ]

    scene = nusc.get("scene", sample["scene_token"])

    return SceneFrame(
        frame_id=sample_token,
        timestamp_us=int(sample["timestamp"]),
        ego=_build_ego_state(ego_pose),
        cameras=cameras,
        lidar=lidar,
        objects=objects,
        metadata={
            "dataset": "nuscenes",
            "version": nusc.version,
            "sample_token": sample_token,
            "scene_token": sample["scene_token"],
            "scene_name": scene["name"],
        },
        diagnostics={
            "object_count": len(objects),
            "camera_count": len(cameras),
            "lidar_present": lidar is not None,
        },
    )
