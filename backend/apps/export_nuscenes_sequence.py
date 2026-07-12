from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

from nuscenes.nuscenes import NuScenes

from bevstack.core.schema import MapLayer, MapPolyline, Vec3
from bevstack.datasets.nuscenes.adapter import sample_to_scene_frame
from bevstack.datasets.nuscenes.config import load_config
from bevstack.datasets.nuscenes.map_provider import NuScenesMapProvider
from bevstack.datasets.nuscenes.paths import (
    DatasetRootNotConfiguredError,
    get_dataset_root_from_env,
    resolve_nuscenes_dataroot,
)
from bevstack.export.scene_exporter import write_scene_frame_json
from bevstack.export.sequence_exporter import build_manifest, frame_filename

_REPO_ROOT = Path(__file__).resolve().parents[2]
_DEFAULT_CONFIG = _REPO_ROOT / "configs" / "nuscenes_mini.yaml"
_DEFAULT_OUTPUT_DIR = _REPO_ROOT / "frontend" / "public" / "scene_frames"


def _find_scene(nusc: NuScenes, scene_name: str | None, scene_token: str | None) -> dict:
    """Resolve a nuScenes scene record by token or name.

    Falls back to the scene of the first sample (matching the single-sample CLI
    default) when neither is provided.
    """
    if scene_token is not None:
        return nusc.get("scene", scene_token)
    if scene_name is not None:
        for scene in nusc.scene:
            if scene["name"] == scene_name:
                return scene
        available = ", ".join(s["name"] for s in nusc.scene)
        raise SystemExit(
            f"Error: no scene named {scene_name!r}. Available: {available}"
        )
    return nusc.get("scene", nusc.get("sample", nusc.sample[0]["token"])["scene_token"])


def _iter_sample_tokens(nusc: NuScenes, first_token: str, max_frames: int):
    """Yield up to max_frames consecutive sample tokens by following sample["next"]."""
    token = first_token
    count = 0
    while token and count < max_frames:
        yield token
        token = nusc.get("sample", token)["next"]
        count += 1


def _build_demo_model_layer() -> MapLayer:
    """A small synthetic model-prediction layer to prove the overlay path.

    Two lane-line predictions slightly offset from typical HD-map geometry,
    with confidences, tagged source="model:lane_demo". Injected into frame 0
    only when --demo-model-layer is passed.
    """
    def line(element_id: str, y: float, conf: float) -> MapPolyline:
        pts = [Vec3(x=float(x), y=y + 0.3, z=0.0) for x in range(-10, 41, 5)]
        return MapPolyline(
            element_id=element_id, points_ego_m=pts, kind="dashed", confidence=conf
        )

    return MapLayer(
        source="model:lane_demo",
        lane_dividers=[line("demo_left", 1.8, 0.92), line("demo_right", -1.8, 0.61)],
        attributes={"note": "synthetic overlay demo, not a real model output"},
    )


def _default_sequence_id(scene_name: str) -> str:
    """Derive a filesystem-safe sequence id from a scene name (e.g. scene-0061 -> nuscenes_scene_0061)."""
    return "nuscenes_" + scene_name.replace("-", "_")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Export consecutive nuScenes samples from a scene as a SceneFrame sequence."
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--scene-name", default=None, help="nuScenes scene name, e.g. scene-0061")
    group.add_argument("--scene-token", default=None, help="nuScenes scene token")
    parser.add_argument(
        "--max-frames", type=int, default=40, help="Maximum number of frames to export (default: 40)"
    )
    parser.add_argument(
        "--output-dir",
        default=str(_DEFAULT_OUTPUT_DIR),
        help=f"Directory to write sequence folders into (default: {_DEFAULT_OUTPUT_DIR})",
    )
    parser.add_argument(
        "--sequence-id",
        default=None,
        help="Sequence folder name (default: derived from scene name)",
    )
    parser.add_argument(
        "--no-map",
        action="store_true",
        help="Skip HD-map extraction (map_layers will be empty)",
    )
    parser.add_argument(
        "--demo-model-layer",
        action="store_true",
        help="Inject a synthetic model:lane_demo map layer into frame 0 (overlay demo)",
    )
    args = parser.parse_args()

    # Surface map-provider INFO logs (e.g. which divider-kind path was taken).
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

    if args.max_frames < 1:
        raise SystemExit("Error: --max-frames must be >= 1")

    try:
        dataset_root = get_dataset_root_from_env()
    except DatasetRootNotConfiguredError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    config = load_config(_DEFAULT_CONFIG)
    dataroot = resolve_nuscenes_dataroot(dataset_root, config.relative_dataroot)

    print(f"Loading nuScenes {config.version} from {dataroot} ...")
    nusc = NuScenes(version=config.version, dataroot=str(dataroot), verbose=False)

    scene = _find_scene(nusc, args.scene_name, args.scene_token)
    sequence_id = args.sequence_id or _default_sequence_id(scene["name"])
    sequence_dir = Path(args.output_dir) / sequence_id
    frames_dir = sequence_dir / "frames"

    print(f"Exporting scene {scene['name']} -> {sequence_dir}")

    map_provider = None if args.no_map else NuScenesMapProvider(dataroot=dataroot)

    frames_meta: list[tuple[int, int]] = []
    for index, sample_token in enumerate(
        _iter_sample_tokens(nusc, scene["first_sample_token"], args.max_frames)
    ):
        frame = sample_to_scene_frame(nusc, sample_token, dataroot, map_provider=map_provider)
        if args.demo_model_layer and index == 0:
            frame.map_layers.append(_build_demo_model_layer())
        write_scene_frame_json(frame, frames_dir / frame_filename(index))
        frames_meta.append((index, frame.timestamp_us))
        print(f"  frame {index:>3}: {sample_token}")

    manifest = build_manifest(
        sequence_id=sequence_id,
        name=scene["name"],
        source="nuscenes",
        frames=frames_meta,
        dataset={
            "version": nusc.version,
            "scene_token": scene["token"],
            "description": scene.get("description", ""),
        },
    )
    manifest_path = sequence_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2))

    print(f"Wrote {len(frames_meta)} frames and {manifest_path}")


if __name__ == "__main__":
    main()
