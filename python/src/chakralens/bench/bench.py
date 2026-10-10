"""chakralens bench: FPS and per-stage latency on synthetic or camera frames."""

from __future__ import annotations

import random
import time

import typer

app = typer.Typer(help="Benchmark the python pipeline.")


@app.command("bench")
def bench_command(
    frames: int = typer.Option(120, "--frames"),
    width: int = typer.Option(640, "--width"),
    height: int = typer.Option(480, "--height"),
) -> None:
    """Render synthetic frames through features+rules+compositor and report timings."""
    import numpy as np

    from chakralens.datasets.synth import preset
    from chakralens.gestures.features import extract_hand
    from chakralens.gestures.rules import classify, load_spec
    from chakralens.render.chidori import render_chidori
    from chakralens.render.compositor import Compositor
    from chakralens.render.rasengan import render_rasengan

    spec = load_spec()
    comp = Compositor(width, height)
    rng = random.Random(7)
    base = np.zeros((height, width, 3), dtype=np.uint8)
    timings = {"features": 0.0, "rules": 0.0, "render": 0.0}
    start = time.perf_counter()
    for i in range(frames):
        hand = preset("rasengan", seed=i % 8)
        t0 = time.perf_counter()
        extract_hand(hand)
        timings["features"] += time.perf_counter() - t0
        t0 = time.perf_counter()
        classify([hand], spec)
        timings["rules"] += time.perf_counter() - t0
        t0 = time.perf_counter()
        comp.reset(base)
        render_rasengan(comp.canvas, width / 2, height / 2, 120.0, i / 30.0, 1.0, rng)
        render_chidori(comp.canvas, width / 2, height / 2, 120.0, i / 30.0, 1.0, rng, i)
        comp.bloom()
        comp.frame()
        timings["render"] += time.perf_counter() - t0
    total = time.perf_counter() - start
    typer.echo(f"frames={frames} size={width}x{height} fps={frames / total:.1f}")
    for stage, spent in timings.items():
        typer.echo(f"{stage}: {spent / frames * 1000:.2f} ms/frame")
