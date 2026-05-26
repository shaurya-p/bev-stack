// Canonical SceneFrame schema — mirrors backend/bevstack/core/schema.py.
// Field names are intentionally stable. Do not rename without updating the Python schema
// and the _EXPECTED_SCENE_FRAME_FIELDS set in tests/test_schema_contracts.py.
//
// Known limitation: timestamp_us is typed as number (64-bit float). Large epoch-microsecond
// values may lose precision. A future ticket will address this with bigint or string encoding.

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface QuaternionWXYZ {
  w: number;
  x: number;
  y: number;
  z: number;
}

export interface Pose3D {
  translation_m: Vec3;
  rotation_quat_wxyz: QuaternionWXYZ;
}

export interface Box3D {
  center_ego_m: Vec3;
  size_lwh_m: Vec3;
  yaw_ego_rad: number;
}

export interface EgoState {
  pose_global: Pose3D | null;
  velocity_ego_mps: Vec3 | null;
}

export interface CameraFrame {
  name: string;
  image_uri: string;
  intrinsics_3x3: number[] | null;
  T_ego_sensor: Pose3D | null;
}

export interface LidarFrame {
  pointcloud_uri: string | null;
  points_ego: Vec3[] | null;
  T_ego_sensor: Pose3D | null;
}

export interface Object3D {
  object_id: string;
  category: string;
  box: Box3D;
  velocity_ego_mps: Vec3 | null;
  confidence: number | null;
  source: string;
  attributes: Record<string, unknown>;
}

export interface SceneFrame {
  frame_id: string;
  timestamp_us: number;
  ego: EgoState;
  cameras: CameraFrame[];
  lidar: LidarFrame | null;
  objects: Object3D[];
  metadata: Record<string, unknown>;
  diagnostics: Record<string, unknown>;
}
