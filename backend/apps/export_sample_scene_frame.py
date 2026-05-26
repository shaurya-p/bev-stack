from __future__ import annotations

from pathlib import Path

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


def _build_sample_frame() -> SceneFrame:
    cameras = [
        CameraFrame(
            name=name,
            image_uri=f"data://sample/cameras/{name.lower()}.jpg",
        )
        for name in _CAMERA_NAMES
    ]

    lidar = LidarFrame(
        pointcloud_uri="data://sample/lidar_top.pcd.bin",
    )

    objects = [
        Object3D(
            object_id="obj_000",
            category="vehicle.car",
            box=Box3D(
                center_ego_m=Vec3(x=15.0, y=0.5, z=0.9),
                size_lwh_m=Vec3(x=4.5, y=2.0, z=1.6),
                yaw_ego_rad=0.05,
            ),
            source="sample",
            velocity_ego_mps=Vec3(x=4.2, y=0.0, z=0.0),
            confidence=None,
            attributes={"is_moving": True},
        ),
        Object3D(
            object_id="obj_001",
            category="human.pedestrian",
            box=Box3D(
                center_ego_m=Vec3(x=5.0, y=8.0, z=0.9),
                size_lwh_m=Vec3(x=0.8, y=0.6, z=1.8),
                yaw_ego_rad=1.57,
            ),
            source="sample",
            velocity_ego_mps=Vec3(x=0.3, y=1.2, z=0.0),
            confidence=None,
            attributes={"is_moving": True},
        ),
        Object3D(
            object_id="obj_002",
            category="vehicle.bicycle",
            box=Box3D(
                center_ego_m=Vec3(x=20.0, y=-3.0, z=0.6),
                size_lwh_m=Vec3(x=1.8, y=0.7, z=1.2),
                yaw_ego_rad=0.1,
            ),
            source="sample",
            velocity_ego_mps=None,
            confidence=None,
            attributes={"is_moving": False},
        ),
    ]

    return SceneFrame(
        frame_id="sample_frame_000",
        timestamp_us=1_620_000_000_000_000,
        ego=EgoState(
            pose_global=None,
            velocity_ego_mps=Vec3(x=5.0, y=0.0, z=0.0),
        ),
        cameras=cameras,
        lidar=lidar,
        objects=objects,
        metadata={
            "scene": "sample",
            "split": "synthetic",
            "note": "Synthetic sample frame — not derived from any real dataset.",
        },
        diagnostics={
            "source": "synthetic",
            "real_data": False,
        },
    )


def main() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    output_path = repo_root / "examples" / "scene_frames" / "sample_scene_frame.json"
    frame = _build_sample_frame()
    write_scene_frame_json(frame, output_path)
    print(f"Written: {output_path}")


if __name__ == "__main__":
    main()
