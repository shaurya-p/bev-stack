def frame_filename(index: int) -> str:
    """Return a 0 padded SceneFrame JSON filename for a frame index"""
    if not isinstance(index, int) or isinstance(index, bool):
        raise TypeError(f"index must be an int, got {type(index).__name__}")
    if index < 0:
        raise ValueError("index must be non-negative")
    return f"{index:06d}.json"

def build_manifest(
        sequence_id: str,
        name: str,
        source: str,
        frames: list[tuple[int, int]],
        dataset: dict | None = None
) -> dict:
    """Build a source-agnostic manifest for a sequence of SCeneFrame files"""
    frame_entries = []

    for frame_idx, timestamp_us in frames:
        frame_entries.append(
            {
                "index": frame_idx,
                "path": f"frames/{frame_filename(frame_idx)}",
                "timestamp_us": timestamp_us
            }
        )
    manifest = {
        "schema_version": 1,
        "sequence_id": sequence_id,
        "name": name,
        "source": source,
        "frame_count": len(frames),
        "frames": frame_entries,
    }
    if dataset is not None:
        manifest["dataset"] = dataset

    return manifest
