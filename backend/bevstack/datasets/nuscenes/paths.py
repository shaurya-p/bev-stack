from __future__ import annotations

import os
from pathlib import Path


class DatasetRootNotConfiguredError(Exception):
    """Raised when the dataset-root environment variable is not set."""


def get_dataset_root_from_env(env_var: str = "BEV_STACK_DATASETS") -> Path:
    """Return the dataset root from an environment variable.

    Expands ``~`` and returns an absolute path.
    Raises :class:`DatasetRootNotConfiguredError` if the variable is not set.
    """
    value = os.environ.get(env_var)
    if value is None:
        raise DatasetRootNotConfiguredError(
            f"Environment variable {env_var!r} is not set. "
            "Set it to the parent directory containing your datasets, e.g.:\n"
            f"  export {env_var}=$HOME/datasets"
        )
    return Path(value).expanduser().resolve()


def resolve_nuscenes_dataroot(
    dataset_root: Path,
    relative_dataroot: str = "nuscenes",
) -> Path:
    """Return the nuScenes dataroot: ``<dataset_root>/<relative_dataroot>``.

    Pure path construction — does not check whether the path exists.
    """
    return dataset_root / relative_dataroot


def resolve_nuscenes_version_dir(
    dataroot: Path,
    version: str = "v1.0-mini",
) -> Path:
    """Return the nuScenes version directory: ``<dataroot>/<version>``.

    Pure path construction — does not check whether the path exists.
    """
    return dataroot / version


def check_nuscenes_dataroot_exists(dataroot: Path) -> None:
    """Raise :class:`FileNotFoundError` if *dataroot* does not exist on disk.

    Separated from pure path construction so callers can choose when to
    validate.  Not called by the other functions in this module.
    """
    if not dataroot.exists():
        raise FileNotFoundError(
            f"nuScenes dataroot not found: {dataroot}\n"
            "Download nuScenes mini from https://www.nuscenes.org/nuscenes "
            "and extract it to the expected location. See docs/nuscenes_setup.md."
        )
