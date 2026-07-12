# SceneFrame Schema

The `SceneFrame` is the canonical unit of data consumed by the bev-stack visualizer and produced by all dataset adapters and model-output providers. It is intentionally **source-agnostic**: the same type represents ground-truth annotations, detector outputs, tracker outputs, and BEV fusion model results.

## Top-level fields

| Field | Type | Description |
|-------|------|-------------|
| `frame_id` | `str` | Unique identifier for this frame (e.g. nuScenes sample token) |
| `timestamp_us` | `int` | Frame timestamp in microseconds since Unix epoch |
| `ego` | `EgoState` | Ego vehicle state at this timestamp |
| `cameras` | `list[CameraFrame]` | Available camera views |
| `lidar` | `LidarFrame \| None` | LiDAR pointcloud, if available |
| `objects` | `list[Object3D]` | 3D objects in ego frame |
| `map_layers` | `list[MapLayer]` | Source-tagged static map layers in ego frame; empty when no map data |
| `metadata` | `dict[str, Any]` | Free-form provenance data (scene name, split, etc.) |
| `diagnostics` | `dict[str, Any]` | Debug/runtime diagnostics; not rendered |

## EgoState

| Field | Type | Description |
|-------|------|-------------|
| `pose_global` | `Pose3D \| None` | Ego pose in the global/map frame (optional metadata) |
| `velocity_ego_mps` | `Vec3 \| None` | Ego velocity in ego frame |

`pose_global` is for provenance and future map/temporal features, not for rendering placement.

## CameraFrame

| Field | Type | Description |
|-------|------|-------------|
| `name` | `str` | Camera name (e.g. `"CAM_FRONT"`) |
| `image_uri` | `str` | URI to the image file or data URL |
| `intrinsics_3x3` | `list[float] \| None` | Row-major 3×3 intrinsics matrix (9 floats) |
| `T_ego_sensor` | `Pose3D \| None` | Transform from sensor frame to ego frame |

## LidarFrame

| Field | Type | Description |
|-------|------|-------------|
| `pointcloud_uri` | `str \| None` | URI to a pointcloud file |
| `points_ego` | `list[Vec3] \| None` | Pointcloud already transformed into ego frame |
| `T_ego_sensor` | `Pose3D \| None` | Transform from sensor frame to ego frame |

## Object3D

| Field | Type | Description |
|-------|------|-------------|
| `object_id` | `str` | Unique object identifier within the frame |
| `category` | `str` | Semantic category (e.g. `"vehicle.car"`) |
| `box` | `Box3D` | 3D bounding box in ego frame |
| `velocity_ego_mps` | `Vec3 \| None` | Object velocity in ego frame; `None` for GT without velocity |
| `confidence` | `float \| None` | Detection/track confidence [0, 1]; `None` for ground truth |
| `source` | `str` | Provenance tag (see below) |
| `attributes` | `dict[str, Any]` | Category-specific attributes (e.g. `{"is_moving": true}`) |

## MapLayer

One source-tagged set of static map elements, mirroring how `objects` carry a `source`. Multiple layers coexist in a frame (e.g. an HD-map ground-truth layer plus an online lane-detection model layer) so ground truth and predictions can overlay. All geometry is in the current ego frame, meters. Layers are optional — an empty `map_layers` list is always valid and the visualizer falls back to a procedural road.

| Field | Type | Description |
|-------|------|-------------|
| `source` | `str` | Provenance tag: `"hd_map:nuscenes"`, `"model:<name>"`, … |
| `drivable_areas` | `list[MapPolygon]` | Drivable surface polygons |
| `lane_dividers` | `list[MapPolyline]` | Lane/road dividers with a semantic `kind` |
| `crosswalks` | `list[MapPolygon]` | Pedestrian crossing polygons |
| `stop_lines` | `list[MapPolyline]` | Stop lines as 2-point transverse bar segments (providers collapse painted-box polygons) |
| `centerlines` | `list[MapPolyline]` | Lane centerlines (optional) |
| `attributes` | `dict[str, Any]` | Layer-level provenance (map location, patch size, …) |

### MapPolygon

| Field | Type | Description |
|-------|------|-------------|
| `element_id` | `str` | Stable element identifier within the layer |
| `exterior_ego_m` | `list[Vec3]` | Closed exterior ring (first point == last point), ego frame, meters |
| `holes_ego_m` | `list[list[Vec3]]` | Interior rings (holes), same convention |
| `confidence` | `float \| None` | `None` for ground truth; set by model layers |

### MapPolyline

| Field | Type | Description |
|-------|------|-------------|
| `element_id` | `str` | Stable element identifier within the layer |
| `points_ego_m` | `list[Vec3]` | Open polyline, ego frame, meters |
| `kind` | `str \| None` | Semantic kind. Dividers: `"solid"`, `"dashed"`, `"road_edge"` |
| `confidence` | `float \| None` | `None` for ground truth; set by model layers |

`kind` and `confidence` are semantic facts. Colors, opacity, dash rendering, and confidence fades are frontend theme decisions keyed by the layer `source`.

## Source field

`source` allows multiple providers to contribute objects to the same frame without schema changes:

| Value | Meaning |
|-------|---------|
| `"gt"` | Ground-truth annotation |
| `"detector:centerpoint"` | CenterPoint detector output |
| `"tracker:kalman_v1"` | Tracker output |
| `"fusion_model:bevfusion"` | BEV fusion model output |

## Serialization

`to_dict(instance)` uses `dataclasses.asdict()` for recursive conversion to a JSON-compatible dict. Field names in the serialized output are **stable** — the TypeScript schema in `frontend/src/schema/sceneFrame.ts` mirrors them exactly. Do not rename fields without updating both.

## Contract fixture

`examples/scene_frames/sample_scene_frame.json` is the committed contract fixture. It is generated by running `uv run python backend/apps/export_sample_scene_frame.py` and contains a synthetic SceneFrame with six cameras, a LiDAR placeholder, and three objects (vehicle, pedestrian, bicycle). The fixture is the first stable artifact the frontend visualizer will consume.

**Known limitation:** `timestamp_us` serializes as a JSON number. TypeScript `number` is a 64-bit float, which loses precision for large epoch-microsecond values (~year 2255 and beyond is fine; sub-microsecond precision is not guaranteed near the epoch edge). A future ticket will address this with `bigint` or string encoding if needed.
