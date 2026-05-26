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

## Note

This ticket only sets up path resolution and the devkit dependency. The actual nuScenes adapter — which loads samples, converts annotations, and exports `SceneFrame` JSON — is the next milestone. See [roadmap.md](roadmap.md).
