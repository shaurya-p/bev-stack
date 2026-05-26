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
class SceneFrame:
    frame_id: str
    timestamp_us: int
    ego: EgoState
    cameras: list[CameraFrame] = field(default_factory=list)
    lidar: LidarFrame | None = None
    objects: list[Object3D] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    diagnostics: dict[str, Any] = field(default_factory=dict)


def to_dict(instance: Any) -> dict[str, Any]:
    """Recursively convert any schema dataclass instance to a JSON-compatible dict."""
    return asdict(instance)
