from __future__ import annotations

from pathlib import Path

import pytest

from bevstack.datasets.nuscenes.paths import (
    DatasetRootNotConfiguredError,
    check_nuscenes_dataroot_exists,
    get_dataset_root_from_env,
    resolve_nuscenes_dataroot,
    resolve_nuscenes_version_dir,
)

_ENV_VAR = "BEV_STACK_DATASETS"


def test_missing_env_var_raises_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(_ENV_VAR, raising=False)
    with pytest.raises(DatasetRootNotConfiguredError, match=_ENV_VAR):
        get_dataset_root_from_env()


def test_env_var_with_tilde_is_expanded(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(_ENV_VAR, "~/datasets")
    result = get_dataset_root_from_env()
    assert "~" not in str(result)
    assert result.is_absolute()


def test_nuscenes_dataroot_resolves_correctly() -> None:
    root = Path("/tmp/ds")
    assert resolve_nuscenes_dataroot(root) == Path("/tmp/ds/nuscenes")


def test_nuscenes_version_dir_resolves_correctly() -> None:
    root = Path("/tmp/ds")
    dataroot = resolve_nuscenes_dataroot(root)
    version_dir = resolve_nuscenes_version_dir(dataroot)
    assert version_dir == Path("/tmp/ds/nuscenes/v1.0-mini")


def test_check_existence_raises_for_missing_path(tmp_path: Path) -> None:
    missing = tmp_path / "nuscenes"
    with pytest.raises(FileNotFoundError, match="nuscenes"):
        check_nuscenes_dataroot_exists(missing)


def test_check_existence_passes_for_real_directory(tmp_path: Path) -> None:
    dataroot = tmp_path / "nuscenes"
    dataroot.mkdir()
    check_nuscenes_dataroot_exists(dataroot)  # must not raise
