# bev-stack

A perception-focused BEV (Bird's-Eye View) visualization and fusion toolkit.

bev-stack defines a canonical **SceneFrame** contract that decouples backend data providers — nuScenes adapters, detector outputs, tracker outputs, and BEV fusion model results — from the web-based visualizer. All rendering code consumes only `SceneFrame` data; dataset-specific coordinate transforms live exclusively in backend adapters.

## Structure

```
backend/    Python package (bevstack) — schema, adapters, providers
frontend/   TypeScript web visualizer — consumes SceneFrame JSON
docs/       Architecture, schema, and coordinate-frame documentation
tests/      Schema contract tests
```

## Getting started

```bash
uv sync                                                          # install project + dev dependencies
uv run pytest                                                    # run schema contract tests
uv run python backend/apps/export_sample_scene_frame.py         # regenerate sample fixture
uv run python backend/apps/inspect_scene_frame.py examples/scene_frames/sample_scene_frame.json
```

## nuScenes setup

Set the `BEV_STACK_DATASETS` environment variable to the parent directory containing your datasets:

```bash
export BEV_STACK_DATASETS=$HOME/datasets
# nuScenes dataroot is expected at $BEV_STACK_DATASETS/nuscenes/
```

See [docs/nuscenes_setup.md](docs/nuscenes_setup.md) for download instructions, the expected directory layout, and how to verify path resolution.

```bash
# Export the first nuScenes mini sample as a SceneFrame JSON
uv run python backend/apps/export_nuscenes_sample.py
# Optional flags: --sample-token <token>  --output <path>
```

## BEV web viewer

```bash
cd frontend
npm install
npm run dev    # starts Vite dev server at http://localhost:5173
npm run build  # type-check + production build → frontend/dist/
```

The viewer loads `public/scene_frames/nuscenes_sample_frame.json` and renders a dark Tesla-inspired BEV canvas with ego box, object boxes, range rings, and a stats HUD.
