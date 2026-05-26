from __future__ import annotations

import json
from pathlib import Path

from bevstack.core.schema import SceneFrame, to_dict


def write_scene_frame_json(frame: SceneFrame, output_path: Path) -> None:
    """Write a SceneFrame to a pretty-printed JSON file, creating parent directories as needed."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(to_dict(frame), indent=2))
