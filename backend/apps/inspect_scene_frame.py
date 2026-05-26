from __future__ import annotations

import argparse
import json
import math
import sys
from collections import Counter
from pathlib import Path

from bevstack.core.validation import validate_scene_frame_dict


def _object_distance(obj: dict) -> float | None:
    try:
        c = obj["box"]["center_ego_m"]
        return math.sqrt(float(c["x"]) ** 2 + float(c["y"]) ** 2 + float(c["z"]) ** 2)
    except (KeyError, TypeError, ValueError):
        return None


def inspect(path: Path) -> None:
    data = json.loads(path.read_text())

    cameras = data.get("cameras") or []
    objects = data.get("objects") or []
    lidar = data.get("lidar")

    cam_names = ", ".join(
        c["name"] for c in cameras if isinstance(c, dict) and "name" in c
    )
    cam_count = len(cameras) if isinstance(cameras, list) else "?"
    obj_count = len(objects) if isinstance(objects, list) else "?"

    print(f"SceneFrame: {path}")
    print(f"  frame_id      : {data.get('frame_id', '<missing>')}")
    print(f"  timestamp_us  : {data.get('timestamp_us', '<missing>')}")
    print(f"  cameras ({cam_count})   : {cam_names or '—'}")
    print(f"  lidar         : {'present' if lidar else 'absent'}")

    if isinstance(objects, list) and objects:
        counts = Counter(
            o["category"]
            for o in objects
            if isinstance(o, dict) and "category" in o
        )
        print(f"  objects ({obj_count})")
        for cat, n in sorted(counts.items(), key=lambda kv: -kv[1]):
            print(f"    {cat:<44} {n}")

        distances = [d for d in (_object_distance(o) for o in objects) if d is not None]
        if distances:
            print(f"  distance      : min={min(distances):.1f} m  max={max(distances):.1f} m")
    else:
        print(f"  objects ({obj_count})")

    issues = validate_scene_frame_dict(data)
    if not issues:
        print("  validation    : OK")
    else:
        print(f"  validation    : {len(issues)} issue(s)")
        for issue in issues:
            print(f"    - {issue}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect a SceneFrame JSON file.")
    parser.add_argument("file", help="Path to the SceneFrame JSON file to inspect")
    args = parser.parse_args()

    path = Path(args.file)
    if not path.exists():
        print(f"Error: file not found: {path}", file=sys.stderr)
        sys.exit(1)

    inspect(path)


if __name__ == "__main__":
    main()
