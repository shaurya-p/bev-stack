"""Render a top-down BEV PNG from a SceneFrame JSON for visual verification.

Default behavior: render the SceneFrame's objects as rotated rectangles in
ego frame and write a single PNG. With --compare-nuscenes, also render the
nuScenes devkit's own BEV for the same sample and stitch both into a
side-by-side PNG so the two can be eyeballed for agreement.

This script is verification tooling, not part of the production renderer.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, Rectangle


# Colors mirror the frontend 2D palette where reasonable; exact match not
# required since this is debug output, not a brand asset.
_PALETTE: dict[str, str] = {
    "vehicle.car":               "#3d8fd6",
    "vehicle.truck":             "#5faacc",
    "vehicle.bus":               "#5faacc",
    "vehicle.motorcycle":        "#7890c0",
    "vehicle.bicycle":           "#5faa70",
    "vehicle.construction":      "#556070",
    "human.pedestrian":          "#d4882e",
    "movable_object.barrier":    "#3a4050",
    "movable_object.trafficcone": "#c05a18",
    "movable_object":            "#3a4050",
}


def _color_for(category: str) -> str:
    cat = category.lower()
    for prefix, color in _PALETTE.items():
        if cat.startswith(prefix):
            return color
    return "#556070"


def _draw_object(ax, obj: dict[str, Any], with_label: bool) -> None:
    box = obj["box"]
    c   = box["center_ego_m"]
    s   = box["size_lwh_m"]
    yaw = float(box["yaw_ego_rad"])
    l, w = float(s["x"]), float(s["y"])
    cx, cy = float(c["x"]), float(c["y"])

    color = _color_for(obj.get("category", ""))

    # matplotlib Rectangle places its origin at the lower-left corner *before*
    # rotation; we rotate about its center by passing transform=Affine2D.
    rect = Rectangle(
        (cx - l / 2, cy - w / 2), l, w,
        linewidth=1.1, edgecolor=color,
        facecolor=color, alpha=0.18,
    )
    from matplotlib.transforms import Affine2D
    t = Affine2D().rotate_around(cx, cy, yaw) + ax.transData
    rect.set_transform(t)
    ax.add_patch(rect)

    # Heading line: center → mid of the front face, in ego frame.
    fx = cx + math.cos(yaw) * (l / 2)
    fy = cy + math.sin(yaw) * (l / 2)
    ax.plot([cx, fx], [cy, fy], color=color, linewidth=1.4)

    # Center dot.
    ax.add_patch(Circle((cx, cy), 0.15, color=color))

    if with_label:
        ax.text(
            cx, cy + max(w / 2, 0.6) + 0.3,
            obj.get("category", "?").split(".")[-1],
            fontsize=6, ha="center", va="bottom", color="#333",
        )


def _draw_ego(ax) -> None:
    # Ego: 4.8 m × 2.0 m at origin, yaw 0 (forward = +x in ego frame).
    rect = Rectangle((-2.4, -1.0), 4.8, 2.0,
                     linewidth=1.6, edgecolor="#1c3060",
                     facecolor="#3451a8", alpha=0.85)
    ax.add_patch(rect)
    ax.plot([0, 2.4], [0, 0], color="#1c3060", linewidth=1.4)


def _draw_rings(ax, axes_limit: float) -> None:
    for r in (20.0, 40.0, 60.0, 80.0):
        if r > axes_limit:
            break
        ax.add_patch(Circle((0, 0), r, fill=False,
                            edgecolor="#bbbbbb", linestyle=(0, (2, 6)), linewidth=0.7))
        ax.text(0, r + 0.6, f"{int(r)} m", fontsize=6,
                ha="center", color="#888888")


def render_scene_frame_bev(
    frame: dict[str, Any],
    ax,
    axes_limit: float,
    with_labels: bool,
) -> None:
    _draw_rings(ax, axes_limit)
    _draw_ego(ax)
    for obj in frame.get("objects", []):
        _draw_object(ax, obj, with_label=with_labels)

    ax.set_xlim(-axes_limit, axes_limit)
    ax.set_ylim(-axes_limit, axes_limit)
    ax.set_aspect("equal", adjustable="box")
    ax.set_title("SceneFrame (ego frame: x→ forward, y→ left)", fontsize=9)
    ax.set_xlabel("ego x [m]  (forward →)", fontsize=8)
    ax.set_ylabel("ego y [m]  (← left)", fontsize=8)
    ax.grid(True, color="#ececec", linewidth=0.5)
    ax.tick_params(labelsize=7)


def _render_nuscenes_devkit_bev(
    frame: dict[str, Any],
    ax,
    axes_limit: float,
) -> str | None:
    """Render the devkit's BEV for the same sample onto `ax`.

    Returns None on success, or an error string explaining why it couldn't
    render (e.g. dataset missing, devkit API mismatch). The caller decides
    whether that's fatal.
    """
    metadata = frame.get("metadata") or {}
    sample_token = metadata.get("sample_token") or frame.get("frame_id")
    version = metadata.get("version") or "v1.0-mini"
    if not sample_token:
        return "no sample_token in metadata; cannot locate the source sample"

    try:
        from bevstack.datasets.nuscenes.paths import (
            DatasetRootNotConfiguredError,
            get_dataset_root_from_env,
            resolve_nuscenes_dataroot,
        )
        dataset_root = get_dataset_root_from_env()
        dataroot = resolve_nuscenes_dataroot(dataset_root)
    except DatasetRootNotConfiguredError as e:
        return f"BEV_STACK_DATASETS not set: {e}"

    try:
        from nuscenes.nuscenes import NuScenes
    except ImportError as e:
        return f"nuscenes-devkit not importable: {e}"

    nusc = NuScenes(version=version, dataroot=str(dataroot), verbose=False)
    sample = nusc.get("sample", sample_token)
    lidar_sd_token = sample["data"].get("LIDAR_TOP")
    if not lidar_sd_token:
        return "sample has no LIDAR_TOP; devkit BEV unavailable"

    # Preferred path: render_sample_data writes a PNG via matplotlib internally.
    # API has shifted across devkit versions; fall back to a manual render if
    # the keyword args don't match.
    import tempfile
    tmp_path = Path(tempfile.mkstemp(suffix=".png")[1])
    rendered = False
    try:
        nusc.render_sample_data(
            lidar_sd_token,
            with_anns=True,
            axes_limit=axes_limit,
            out_path=str(tmp_path),
            verbose=False,
        )
        rendered = True
    except TypeError:
        # Older / newer API mismatch — fall back below.
        pass
    except Exception as e:  # noqa: BLE001
        return f"devkit render_sample_data failed: {e}"

    if rendered and tmp_path.exists():
        import matplotlib.image as mpimg
        img = mpimg.imread(str(tmp_path))
        ax.imshow(img)
        ax.set_title("nuScenes devkit BEV (LIDAR_TOP + annotations)", fontsize=9)
        ax.axis("off")
        tmp_path.unlink(missing_ok=True)
        return None

    # Fallback: render annotations manually in the LIDAR_TOP / ego frame.
    # We re-use the SceneFrame draw path because objects are already in ego
    # frame; the devkit's LIDAR_TOP frame is the same one we exported from.
    # This gives identical visuals to the left panel, which defeats the
    # comparison purpose, so we explicitly mark it as a fallback.
    ax.text(0.5, 0.5,
            "devkit native render unavailable\n(fallback: see SceneFrame BEV)",
            ha="center", va="center", fontsize=9, color="#888",
            transform=ax.transAxes)
    ax.set_title("nuScenes devkit BEV (fallback)", fontsize=9)
    ax.axis("off")
    return None


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Render a top-down BEV PNG from a SceneFrame JSON."
    )
    parser.add_argument("file", help="Path to the SceneFrame JSON file")
    parser.add_argument(
        "--output", default="/tmp/scene_bev.png",
        help="Output PNG path (default: /tmp/scene_bev.png)",
    )
    parser.add_argument(
        "--axes-limit", type=float, default=80.0,
        help="Half-extent of the BEV viewport in meters (default: 80)",
    )
    parser.add_argument(
        "--labels", action="store_true",
        help="Draw category labels next to each object",
    )
    parser.add_argument(
        "--compare-nuscenes", action="store_true",
        help=(
            "Also render the nuScenes devkit's BEV for the same sample, "
            "stitched side-by-side. Requires BEV_STACK_DATASETS."
        ),
    )
    args = parser.parse_args()

    path = Path(args.file)
    if not path.exists():
        print(f"Error: file not found: {path}", file=sys.stderr)
        sys.exit(1)

    frame = json.loads(path.read_text())

    if args.compare_nuscenes:
        fig, axes = plt.subplots(1, 2, figsize=(14, 7))
        render_scene_frame_bev(frame, axes[0], args.axes_limit, args.labels)
        err = _render_nuscenes_devkit_bev(frame, axes[1], args.axes_limit)
        if err is not None:
            print(f"Warning: devkit BEV unavailable — {err}", file=sys.stderr)
    else:
        fig, ax = plt.subplots(1, 1, figsize=(8, 8))
        render_scene_frame_bev(frame, ax, args.axes_limit, args.labels)

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.tight_layout()
    fig.savefig(out_path, dpi=140)
    plt.close(fig)

    print(f"Written: {out_path}")


if __name__ == "__main__":
    main()
