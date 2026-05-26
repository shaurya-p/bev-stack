# Coordinate Frames

## Internal ego-frame convention

All renderable geometry in `SceneFrame` uses the **current ego frame**:

| Axis | Direction |
|------|-----------|
| x    | forward   |
| y    | left      |
| z    | up        |

This is a right-handed coordinate system. Yaw is measured in radians in the x-y plane, counter-clockwise from x-forward.

## Object geometry fields

| Field | Convention |
|-------|-----------|
| `Box3D.center_ego_m` | Box center in ego-frame metres |
| `Box3D.size_lwh_m` | Length (x), width (y), height (z) in metres |
| `Box3D.yaw_ego_rad` | Yaw angle in the ego-frame x-y plane, radians |
| `Object3D.velocity_ego_mps` | Velocity vector in ego-frame m/s |

## What belongs in backend adapters, not the renderer

The following transforms are the exclusive responsibility of **backend adapters and providers**:

- nuScenes global frame → ego frame
- nuScenes sensor frame → ego frame
- Camera extrinsic/intrinsic transforms
- Any dataset-specific axis flips or reorientations
- LiDAR-to-ego rigid body transforms

The renderer reads `SceneFrame` geometry as-is and assumes it is already in the ego frame defined above.

## Optional global pose

`EgoState.pose_global` is optional metadata for temporal/global reasoning, map alignment, and dataset provenance. It is **not used by the renderer for geometry placement** — renderable geometry is already in the ego frame.

## nuScenes note

nuScenes uses a different convention (sensor frames vary by sensor; the global frame has x forward, y left, z up at the reference keyframe but objects are described in global coordinates). Adapters must convert all geometry to the bev-stack ego convention before populating `SceneFrame`. See future `backend/bevstack/adapters/nuscenes.py`.
