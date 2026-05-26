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
```
