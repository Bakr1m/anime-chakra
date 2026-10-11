"""chakralens extract: phone videos -> landmark datasets.

Folder name = label: videos/rasengan/clip.mp4 -> data/rasengan.jsonl
"""

from __future__ import annotations

import time
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Protocol

import typer

from chakralens.datasets.record_cmd import write_samples

app = typer.Typer(help="Extract landmark datasets from videos.")

VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv", ".webm"}


class Detected(Protocol):
    handedness: str
    landmarks: list[dict[str, float]]


def extract_video(
    video: Path,
    label: str,
    detect: Callable[[object, int], list[Detected]],
    every: int = 3,
) -> list[dict[str, Any]]:
    """Decode with OpenCV, run detect(frame_bgr, ms) every Nth frame."""
    import cv2

    cap = cv2.VideoCapture(str(video))
    samples: list[dict[str, Any]] = []
    index = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if index % every == 0:
            hands = detect(frame, index * 33)
            if hands:
                samples.append(
                    {
                        "version": 1,
                        "label": label,
                        "source": "video-extract",
                        "capturedAt": datetime.now(UTC).isoformat(),
                        "video": str(video),
                        "frameIndex": index,
                        "landmarks": [
                            {"handedness": h.handedness, "points": h.landmarks} for h in hands
                        ],
                    }
                )
        index += 1
    cap.release()
    return samples


@app.command("extract")
def extract_command(
    videos: Path = typer.Argument(  # noqa: B008
        ..., help="Folder of <label>/clip.mp4 folders."
    ),
    out: Path = typer.Option(Path("data"), help="Output directory."),  # noqa: B008
    every: int = typer.Option(3, "--every", help="Detect every Nth frame."),
) -> None:
    """Turn phone-recorded videos into landmark datasets."""
    from chakralens.vision.hands import HandTracker

    try:
        tracker = HandTracker()
        tracker.start()
    except FileNotFoundError as exc:
        typer.echo(str(exc))
        raise typer.Exit(2)

    def detect(frame: object, ms: int) -> list[Detected]:
        from typing import cast

        import numpy as np
        from numpy.typing import NDArray

        return list(tracker.detect(cast("NDArray[np.uint8]", frame), ms))

    total = 0
    try:
        for label_dir in sorted(p for p in videos.iterdir() if p.is_dir()):
            clips = sorted(p for p in label_dir.iterdir() if p.suffix.lower() in VIDEO_EXTS)
            if not clips:
                typer.echo(f"skip {label_dir.name}: no videos")
                continue
            samples: list[dict[str, Any]] = []
            for clip in clips:
                found = extract_video(clip, label_dir.name, detect, every=every)
                samples.extend(found)
                typer.echo(f"{clip.name}: {len(found)} samples")
            if samples:
                write_samples(samples, out / f"{label_dir.name}.jsonl")
            total += len(samples)
            _ = time.time
    finally:
        tracker.stop()
    typer.echo(f"total {total} samples in {out}")
