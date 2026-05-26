from __future__ import annotations

import math
from typing import Any

_REQUIRED_TOP_LEVEL = frozenset({
    "frame_id", "timestamp_us", "ego", "cameras",
    "lidar", "objects", "metadata", "diagnostics",
})

_REQUIRED_OBJECT_FIELDS = frozenset({"object_id", "category", "source", "box"})
_REQUIRED_BOX_FIELDS = frozenset({"center_ego_m", "size_lwh_m", "yaw_ego_rad"})

_LARGE_DISTANCE_THRESHOLD_M = 500.0


def validate_scene_frame_dict(data: dict) -> list[str]:
    """Return a list of human-readable issues found in a SceneFrame dict.

    Returns an empty list if no issues are found. Never raises.
    Advisory issues (non-fatal) are prefixed with "WARNING:".

    Intentionally not validated: ego sub-fields, camera/lidar URI values,
    intrinsics ranges, object confidence range, and free-form dict contents
    (attributes, metadata, diagnostics).
    """
    if not isinstance(data, dict):
        return ["SceneFrame must be a dict"]

    issues: list[str] = []

    for f in sorted(_REQUIRED_TOP_LEVEL):
        if f not in data:
            issues.append(f"missing required field '{f}'")

    if issues:
        return issues

    if not isinstance(data["cameras"], list):
        issues.append("'cameras' must be a list")
    if not isinstance(data["objects"], list):
        issues.append("'objects' must be a list")
    if not isinstance(data["timestamp_us"], int):
        issues.append(
            f"'timestamp_us' must be int, got {type(data['timestamp_us']).__name__}"
        )
    if not isinstance(data["metadata"], dict):
        issues.append("'metadata' must be a dict")
    if not isinstance(data["diagnostics"], dict):
        issues.append("'diagnostics' must be a dict")

    if isinstance(data["objects"], list):
        for i, obj in enumerate(data["objects"]):
            issues.extend(_validate_object(i, obj))

    return issues


def _validate_object(idx: int, obj: Any) -> list[str]:
    issues: list[str] = []
    prefix = f"objects[{idx}]"

    if not isinstance(obj, dict):
        issues.append(f"{prefix}: must be a dict")
        return issues

    for f in sorted(_REQUIRED_OBJECT_FIELDS):
        if f not in obj:
            issues.append(f"{prefix}: missing required field '{f}'")

    box = obj.get("box")
    if box is None:
        return issues

    if not isinstance(box, dict):
        issues.append(f"{prefix}.box: must be a dict")
        return issues

    for f in sorted(_REQUIRED_BOX_FIELDS):
        if f not in box:
            issues.append(f"{prefix}.box: missing field '{f}'")

    if isinstance(box.get("center_ego_m"), dict):
        issues.extend(_check_vec3_finite(f"{prefix}.box.center_ego_m", box["center_ego_m"]))
        issues.extend(_check_large_distance(prefix, box["center_ego_m"]))

    if isinstance(box.get("size_lwh_m"), dict):
        issues.extend(_check_vec3_positive(f"{prefix}.box.size_lwh_m", box["size_lwh_m"]))

    yaw = box.get("yaw_ego_rad")
    if yaw is not None and not _is_finite(yaw):
        issues.append(f"{prefix}.box.yaw_ego_rad: must be a finite number, got {yaw!r}")

    return issues


def _is_finite(val: Any) -> bool:
    try:
        return isinstance(val, (int, float)) and math.isfinite(float(val))
    except (TypeError, ValueError):
        return False


def _check_vec3_finite(label: str, v: dict) -> list[str]:
    return [
        f"{label}.{axis}: must be a finite number, got {v.get(axis)!r}"
        for axis in ("x", "y", "z")
        if not _is_finite(v.get(axis))
    ]


def _check_vec3_positive(label: str, v: dict) -> list[str]:
    issues = []
    for axis in ("x", "y", "z"):
        val = v.get(axis)
        if not (_is_finite(val) and float(val) > 0):
            issues.append(f"{label}.{axis}: must be a positive finite number, got {val!r}")
    return issues


def _check_large_distance(prefix: str, center: dict) -> list[str]:
    try:
        dist = math.sqrt(
            float(center.get("x", 0)) ** 2
            + float(center.get("y", 0)) ** 2
            + float(center.get("z", 0)) ** 2
        )
    except (TypeError, ValueError):
        return []
    if dist > _LARGE_DISTANCE_THRESHOLD_M:
        return [
            f"WARNING: {prefix}.box.center_ego_m is {dist:.1f} m from ego "
            f"(>{_LARGE_DISTANCE_THRESHOLD_M:.0f} m — possible coordinate frame error)"
        ]
    return []
