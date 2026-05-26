from __future__ import annotations

import argparse
import sys
from pathlib import Path

from nuscenes.nuscenes import NuScenes

from bevstack.datasets.nuscenes.adapter import sample_to_scene_frame
from bevstack.datasets.nuscenes.config import load_config
from bevstack.datasets.nuscenes.paths import (
    DatasetRootNotConfiguredError,
    get_dataset_root_from_env,
    resolve_nuscenes_dataroot,
)
from bevstack.export.scene_exporter import write_scene_frame_json

_REPO_ROOT = Path(__file__).resolve().parents[2]
_DEFAULT_CONFIG = _REPO_ROOT / "configs" / "nuscenes_mini.yaml"
_DEFAULT_OUTPUT = _REPO_ROOT / "examples" / "scene_frames" / "nuscenes_sample_frame.json"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Export one nuScenes sample as a SceneFrame JSON file."
    )
    parser.add_argument(
        "--sample-token",
        default=None,
        help="nuScenes sample token to export (default: first sample in the dataset)",
    )
    parser.add_argument(
        "--output",
        default=str(_DEFAULT_OUTPUT),
        help=f"Output JSON path (default: {_DEFAULT_OUTPUT})",
    )
    args = parser.parse_args()

    try:
        dataset_root = get_dataset_root_from_env()
    except DatasetRootNotConfiguredError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    config = load_config(_DEFAULT_CONFIG)
    dataroot = resolve_nuscenes_dataroot(dataset_root, config.relative_dataroot)

    print(f"Loading nuScenes {config.version} from {dataroot} ...")
    nusc = NuScenes(version=config.version, dataroot=str(dataroot), verbose=False)

    sample_token = args.sample_token or nusc.sample[0]["token"]
    print(f"Exporting sample: {sample_token}")

    frame = sample_to_scene_frame(nusc, sample_token, dataroot)
    output_path = Path(args.output)
    write_scene_frame_json(frame, output_path)
    print(f"Written: {output_path}")


if __name__ == "__main__":
    main()
