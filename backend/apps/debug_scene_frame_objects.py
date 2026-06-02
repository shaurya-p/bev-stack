"""Per-object verification CLI for an exported SceneFrame JSON.

Prints one row per object (sorted by distance from ego) with placement,
dimensions, yaw, and provenance. Optional --check-* flags double the script
as a correctness gate suitable for CI: any failed check exits non-zero.

This tool exists to surface bugs in the export path before they propagate
into the 3D viewer. It does not modify any data.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from collections import Counter
from pathlib import Path
from typing import Any


def _distance_xy(center: dict[str, float]) -> float:
    return math.sqrt(float(center["x"]) ** 2 + float(center["y"]) ** 2)


def _format_token(token: str | None, width: int = 10) -> str:
    if not token:
        return "—"
    return token[:width] + ("…" if len(token) > width else "")


def _row(obj: dict[str, Any], idx: int) -> dict[str, Any]:
    box = obj["box"]
    c   = box["center_ego_m"]
    s   = box["size_lwh_m"]
    yaw = float(box["yaw_ego_rad"])
    attrs = obj.get("attributes") or {}
    return {
        "idx":       idx,
        "dist":      _distance_xy(c),
        "category":  obj.get("category", "<missing>"),
        "x":         float(c["x"]),
        "y":         float(c["y"]),
        "z":         float(c["z"]),
        "L":         float(s["x"]),
        "W":         float(s["y"]),
        "H":         float(s["z"]),
        "yaw_deg":   math.degrees(yaw),
        "ann_token": attrs.get("nuscenes_annotation_token"),
        "source":    obj.get("source", "<missing>"),
        "raw_wlh":   attrs.get("nuscenes_size_wlh"),
    }


def _print_table(rows: list[dict[str, Any]]) -> None:
    header = (
        f"{'idx':>4} {'dist[m]':>8} "
        f"{'category':<38} "
        f"{'x':>7} {'y':>7} {'z':>6} "
        f"{'L':>5} {'W':>5} {'H':>5} "
        f"{'yaw[°]':>8} "
        f"{'ann_token':<12} {'source':<14}"
    )
    print(header)
    print("-" * len(header))
    for r in rows:
        print(
            f"{r['idx']:>4} {r['dist']:>8.2f} "
            f"{r['category']:<38} "
            f"{r['x']:>7.2f} {r['y']:>7.2f} {r['z']:>6.2f} "
            f"{r['L']:>5.2f} {r['W']:>5.2f} {r['H']:>5.2f} "
            f"{r['yaw_deg']:>8.2f} "
            f"{_format_token(r['ann_token']):<12} {r['source']:<14}"
        )


def _print_summary(rows: list[dict[str, Any]], total: int) -> None:
    if not rows:
        print("SUMMARY: 0 objects")
        return
    cats = Counter(r["category"] for r in rows)
    dists = [r["dist"] for r in rows]
    max_x = max(abs(r["x"]) for r in rows)
    max_y = max(abs(r["y"]) for r in rows)
    print(
        f"SUMMARY: {len(rows)}/{total} shown · {len(cats)} categories · "
        f"nearest={min(dists):.2f}m · farthest={max(dists):.2f}m · "
        f"max|x|={max_x:.2f}m · max|y|={max_y:.2f}m"
    )


def _check_size(rows: list[dict[str, Any]], tol: float = 1e-6) -> list[str]:
    """Compare size_lwh_m against the raw nuScenes [w, l, h] in attributes."""
    failures: list[str] = []
    for r in rows:
        wlh = r["raw_wlh"]
        if wlh is None:
            # Provenance not present — not a failure, just skip silently.
            continue
        if len(wlh) != 3:
            failures.append(f"#{r['idx']} ({r['category']}): raw_wlh has wrong length")
            continue
        expected_l = float(wlh[1])
        expected_w = float(wlh[0])
        expected_h = float(wlh[2])
        if (abs(r["L"] - expected_l) > tol
                or abs(r["W"] - expected_w) > tol
                or abs(r["H"] - expected_h) > tol):
            failures.append(
                f"#{r['idx']} ({r['category']}): "
                f"size_lwh=({r['L']:.3f},{r['W']:.3f},{r['H']:.3f}) "
                f"≠ reorder(raw_wlh={wlh}) "
                f"expected=({expected_l:.3f},{expected_w:.3f},{expected_h:.3f})"
            )
    return failures


def _check_distance(rows: list[dict[str, Any]], threshold: float) -> list[str]:
    """Flag suspiciously large distances (would indicate global-coord leakage)."""
    failures: list[str] = []
    for r in rows:
        if r["dist"] > threshold:
            failures.append(
                f"#{r['idx']} ({r['category']}): dist={r['dist']:.1f}m exceeds "
                f"threshold {threshold:.1f}m — possible global-coordinate leakage"
            )
    return failures


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Per-object debug view of an exported SceneFrame JSON. "
            "Use --check-* flags to validate placement, sizing, and provenance."
        )
    )
    parser.add_argument("file", help="Path to the SceneFrame JSON file")
    parser.add_argument(
        "--limit", type=int, default=None,
        help="Show only the N closest objects (default: all)",
    )
    parser.add_argument(
        "--category", default=None,
        help="Substring filter on category (case-insensitive)",
    )
    parser.add_argument(
        "--source", default=None,
        help="Substring filter on source (case-insensitive)",
    )
    parser.add_argument(
        "--check-size", action="store_true",
        help="Verify size_lwh_m == reorder(nuscenes_size_wlh) for all objects",
    )
    parser.add_argument(
        "--check-distance", action="store_true",
        help="Flag any object whose XY distance exceeds --max-distance",
    )
    parser.add_argument(
        "--max-distance", type=float, default=200.0,
        help="Distance threshold for --check-distance (default: 200 m)",
    )
    args = parser.parse_args()

    path = Path(args.file)
    if not path.exists():
        print(f"Error: file not found: {path}", file=sys.stderr)
        sys.exit(1)

    data = json.loads(path.read_text())
    objects = data.get("objects") or []
    total = len(objects)

    rows = [_row(o, i) for i, o in enumerate(objects)]
    rows.sort(key=lambda r: r["dist"])

    if args.category:
        needle = args.category.lower()
        rows = [r for r in rows if needle in r["category"].lower()]
    if args.source:
        needle = args.source.lower()
        rows = [r for r in rows if needle in r["source"].lower()]

    shown = rows[: args.limit] if args.limit else rows

    print(f"SceneFrame: {path}")
    print(f"  frame_id={data.get('frame_id', '<missing>')}")
    print()
    _print_table(shown)
    print()
    _print_summary(shown, total)

    failures: list[str] = []
    if args.check_size:
        failures += _check_size(rows)
    if args.check_distance:
        failures += _check_distance(rows, args.max_distance)

    if failures:
        print()
        print(f"FAILURES ({len(failures)}):", file=sys.stderr)
        for f in failures:
            print(f"  - {f}", file=sys.stderr)
        sys.exit(2)

    if args.check_size or args.check_distance:
        print()
        print("All requested checks passed.")


if __name__ == "__main__":
    main()
