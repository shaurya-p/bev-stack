from __future__ import annotations


def us_to_s(timestamp_us: int) -> float:
    """Convert microseconds to seconds."""
    return timestamp_us / 1_000_000


def s_to_us(timestamp_s: float) -> int:
    """Convert seconds to microseconds."""
    return int(timestamp_s * 1_000_000)
