# nuScenes Setup

## Download

Request access and download **nuScenes mini** from the official site:
https://www.nuscenes.org/nuscenes

Download the **Full dataset (v1.0-mini)** metadata and sensor blobs. Extract to your local datasets directory.

## Expected directory layout

```
$BEV_STACK_DATASETS/
  nuscenes/
    samples/       # key-frame sensor data
    sweeps/        # non-key-frame sensor data
    maps/          # map tiles
    v1.0-mini/     # metadata JSON files (samples, annotations, calibration, etc.)
```

`BEV_STACK_DATASETS` is the **parent** directory, not the nuScenes dataroot itself.
The nuScenes dataroot is `$BEV_STACK_DATASETS/nuscenes`.

## Setting the environment variable

```bash
export BEV_STACK_DATASETS=$HOME/datasets
```

Add this to your shell profile (`~/.zshrc`, `~/.bashrc`) to persist it across sessions.

## Verifying path resolution

```bash
uv run python -c "
from bevstack.datasets.nuscenes.paths import (
    get_dataset_root_from_env,
    resolve_nuscenes_dataroot,
    resolve_nuscenes_version_dir,
    check_nuscenes_dataroot_exists,
)
root = get_dataset_root_from_env()
dataroot = resolve_nuscenes_dataroot(root)
version_dir = resolve_nuscenes_version_dir(dataroot)
print('Dataset root:  ', root)
print('nuScenes root: ', dataroot)
print('Version dir:   ', version_dir)
check_nuscenes_dataroot_exists(dataroot)
print('Dataroot exists: OK')
"
```

## Verifying the devkit import

```bash
uv run python -c "import nuscenes; print('nuscenes import ok')"
```

## Exporting a sample

With `BEV_STACK_DATASETS` set and the dataset extracted, export the first sample:

```bash
uv run python backend/apps/export_nuscenes_sample.py
# Optional: --sample-token <token>  --output <path>
```

This writes `examples/scene_frames/nuscenes_sample_frame.json` — one real nuScenes sample converted to the canonical SceneFrame schema with all object geometry in the ego frame.

## Note

This covers a minimal one-sample nuScenes export: one sample, six cameras, one lidar reference, and object annotations converted from global to ego-frame coordinates. It does not cover full-scene iteration, lidar point processing, sweeps, maps, or model-output providers. See [roadmap.md](roadmap.md) for upcoming milestones.
