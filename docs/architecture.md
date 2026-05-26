# Architecture

bev-stack separates concerns into four distinct layers.

## 1. Dataset adapters

Convert raw dataset formats (nuScenes, Waymo, custom) into `SceneFrame` objects. Responsible for all coordinate-frame transforms — sensor → ego, global → ego, etc. Lives in `backend/bevstack/adapters/`.

## 2. Model-output providers

Convert detector, tracker, or BEV fusion model outputs into `SceneFrame` objects. Same contract as adapters: produce ego-frame geometry, tag objects with a `source` string. Lives in `backend/bevstack/providers/`.

## 3. SceneFrame contract

The shared schema between backends and the visualizer. Defined in `backend/bevstack/core/schema.py` and mirrored as TypeScript interfaces in `frontend/src/schema/sceneFrame.ts`. See [schema.md](schema.md) for field intent and [coordinate_frames.md](coordinate_frames.md) for the ego-frame convention.

## 4. Renderer / visualizer

Consumes `SceneFrame` JSON only. Has no knowledge of dataset formats, sensor models, or coordinate transforms. Rendering code must not contain dataset-specific logic.

## Data flow

```
Raw data                   SceneFrame                 Renderer
(nuScenes / model) ──►  (ego-frame geometry) ──►  (web BEV + camera panels)
        ▲                        ▲
  adapter / provider       schema contract
```

The renderer is intentionally isolated. Adding a new data source means writing a new adapter or provider — the visualizer is unchanged.
