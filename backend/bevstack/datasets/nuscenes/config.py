from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import yaml


@dataclass
class NuScenesAdapterConfig:
    dataset: str
    version: str
    dataroot_env: str
    relative_dataroot: str
    split: str


def load_config(config_path: Path) -> NuScenesAdapterConfig:
    """Load a NuScenesAdapterConfig from a YAML file."""
    with Path(config_path).open() as f:
        data = yaml.safe_load(f)
    return NuScenesAdapterConfig(**data)
