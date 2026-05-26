from __future__ import annotations

import json

from bevstack.core.schema import SceneFrame, to_dict


def scene_frame_to_json(frame: SceneFrame, *, indent: int | None = None) -> str:
    """Serialize a SceneFrame to a JSON string."""
    return json.dumps(to_dict(frame), indent=indent)
