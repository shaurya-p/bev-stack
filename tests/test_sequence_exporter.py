import pytest

from bevstack.export.sequence_exporter import build_manifest, frame_filename

def test_frame_filename_zero_pads_index():
    assert frame_filename(0) == "000000.json"
    assert frame_filename(21) == "000021.json"
    assert frame_filename(123) == "000123.json"

def test_frame_filename_rejects_negative_index():
    with pytest.raises(ValueError):
        frame_filename(-1)

def test_build_manifest_creates_relative_frame_entries():
    manifest = build_manifest(
        sequence_id="seq_001",
        name="Test sequence",
        source="synthetic",
        frames=[(0, 1000), (1, 2000)],
    )

    assert manifest["schema_version"] == 1
    assert manifest["sequence_id"] == "seq_001"
    assert manifest["name"] == "Test sequence"
    assert manifest["source"] == "synthetic"
    assert manifest["frame_count"] == 2

    assert manifest["frames"] == [
        {"index": 0, "path": "frames/000000.json", "timestamp_us": 1000},
        {"index": 1, "path": "frames/000001.json", "timestamp_us": 2000},
    ]