"""Dataset I/O validation, writer round-trip, video extraction with a fake detector."""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

from chakralens.datasets import io as dataset_io
from chakralens.datasets.extract_cmd import extract_video
from chakralens.datasets.record_cmd import write_samples


def _sample(label: str = "rasengan") -> dict:
    pts = [{"x": 0.1 * i, "y": 0.2 * i, "z": 0.0} for i in range(21)]
    return {
        "version": 1,
        "label": label,
        "source": "test",
        "landmarks": [{"handedness": "Left", "points": pts}],
    }


def test_validate_ok_and_bad() -> None:
    assert dataset_io.validate_sample(_sample()) == []
    bad = _sample()
    bad["label"] = "kamehameha"
    assert dataset_io.validate_sample(bad) != []
    bad2 = _sample()
    bad2["landmarks"] = []
    assert dataset_io.validate_sample(bad2) != []


def test_sample_to_training_mapping() -> None:
    conv = dataset_io.sample_to_training(_sample("rasengan"))
    assert conv is not None and conv[1] == "rasengan" and len(conv[0]) == 63
    assert dataset_io.sample_to_training(_sample("katon"))[1] == "tiger"  # type: ignore[index]
    assert dataset_io.sample_to_training(_sample("bunshin"))[1] == "cross"  # type: ignore[index]
    assert dataset_io.sample_to_training(_sample("none")) is None


def test_write_and_load_round_trip(tmp_path: Path) -> None:
    out = tmp_path / "r.jsonl"
    write_samples([_sample("chidori"), _sample("chidori")], out)
    xs, ys = dataset_io.load_dir(tmp_path)
    assert ys == ["chidori", "chidori"]
    assert len(xs) == 2 and len(xs[0]) == 63


def test_extract_video_with_fake_detector(tmp_path: Path) -> None:
    clip = tmp_path / "clip.mp4"
    writer = cv2.VideoWriter(str(clip), cv2.VideoWriter_fourcc(*"mp4v"), 10, (64, 48))
    for _ in range(6):
        writer.write(np.zeros((48, 64, 3), dtype=np.uint8))
    writer.release()

    from typing import ClassVar

    class Hand:
        handedness: ClassVar[str] = "Right"
        landmarks: ClassVar[list[dict[str, float]]] = [
            {"x": 0.01 * i, "y": 0.0, "z": 0.0} for i in range(21)
        ]

    calls: list[int] = []

    def fake_detect(frame: object, ms: int) -> list[object]:
        calls.append(ms)
        return [Hand()]

    samples = extract_video(clip, "rasengan", fake_detect, every=2)
    assert len(samples) == 3
    assert samples[0]["video"] == str(clip)
    assert len(calls) == 3
