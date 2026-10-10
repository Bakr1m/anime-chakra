"""chakralens record: labelled landmark capture from the desktop camera."""

from __future__ import annotations

import json
import time
from datetime import UTC, datetime
from pathlib import Path

import typer

app = typer.Typer(help="Record labelled landmark samples.")


def write_samples(samples: list[dict], out: Path) -> Path:
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        f.writelines(json.dumps(sample) + "\n" for sample in samples)
    return out


@app.command("record")
def record_command(
    label: str = typer.Option(..., "--label", help="One of the dataset schema labels."),
    seconds: float = typer.Option(3.0, "--seconds"),
    camera: int = typer.Option(0, "--camera"),
    out: Path = typer.Option(  # noqa: B008
        Path("data/recorded.jsonl"), help="Output JSONL file (appended)."
    ),
) -> None:
    """Capture --seconds of landmarks for --label from the webcam."""
    from chakralens.capture.capture import ThreadedCamera
    from chakralens.vision.hands import HandTracker

    tracker = HandTracker()
    try:
        tracker.start()
    except FileNotFoundError as exc:
        typer.echo(str(exc))
        raise typer.Exit(2)
    cam = ThreadedCamera(camera=camera).start()
    samples: list[dict] = []
    deadline = time.time() + seconds
    typer.echo(f"recording {label} for {seconds}s: hold the sign...")
    try:
        while time.time() < deadline:
            frame = cam.read()
            if frame is None:
                time.sleep(0.005)
                continue
            hands = tracker.detect(frame.image, int(time.time() * 1000))
            if not hands:
                continue
            samples.append(
                {
                    "version": 1,
                    "label": label,
                    "source": "desktop-record",
                    "capturedAt": datetime.now(UTC).isoformat(),
                    "frameIndex": frame.index,
                    "landmarks": [
                        {"handedness": h.handedness, "points": h.landmarks} for h in hands
                    ],
                }
            )
    finally:
        cam.stop()
        tracker.stop()
    if samples:
        write_samples(samples, out)
    typer.echo(f"saved {len(samples)} samples to {out}")
