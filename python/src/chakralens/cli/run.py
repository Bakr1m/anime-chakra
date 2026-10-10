"""chakralens run: desktop webcam loop with the OpenCV renderer."""

from __future__ import annotations

import random
import time
from pathlib import Path

import typer

app = typer.Typer(help="Live desktop demo (needs a display + GUI OpenCV build).")


@app.command("run")
def run_command(
    camera: int = typer.Option(0, "--camera", help="cv2.VideoCapture index."),
    width: int = typer.Option(640, "--width"),
    height: int = typer.Option(480, "--height"),
    gui: bool = typer.Option(True, help="Show the OpenCV window (needs opencv-python, not headless)."),
) -> None:
    """Open the webcam, recognize the four core signs, render chakra effects."""
    import cv2

    from chakralens.capture.capture import ThreadedCamera
    from chakralens.gestures.rules import classify, load_spec
    from chakralens.gestures.state_machine import JutsuState
    from chakralens.render.bunshin import render_clone, render_poof
    from chakralens.render.chidori import render_chidori
    from chakralens.render.compositor import Compositor
    from chakralens.render.katon import render_katon
    from chakralens.render.rasengan import render_rasengan
    from chakralens.vision.hands import HandTracker

    try:
        tracker = HandTracker()
    except FileNotFoundError as exc:
        typer.echo(str(exc))
        raise typer.Exit(2)
    try:
        tracker.start()
    except Exception as exc:  # noqa: BLE001
        typer.echo(f"vision backend failed: {exc}")
        raise typer.Exit(2)

    cam = ThreadedCamera(camera=camera, width=width, height=height).start()
    spec = load_spec(Path("spec/gestures.json") if Path("spec/gestures.json").exists() else None)
    state = JutsuState()
    comp = Compositor(width, height)
    rng = random.Random(7)
    frame_no = 0
    last = time.time()
    fps = 30.0
    katon_hold = 0.0
    katon_progress: float | None = None
    show = gui
    if show:
        try:
            cv2.namedWindow("chakra")
        except cv2.error:
            typer.echo("GUI unavailable (headless OpenCV). Re-run with --no-gui.")
            show = False

    typer.echo("keys: q quit | s screenshot | 1-4 force jutsu | 0 auto")
    forced: str | None = None
    try:
        while True:
            frame = cam.read()
            if frame is None:
                time.sleep(0.005)
                continue
            now = time.time()
            dt = min(0.1, now - last)
            last = now
            fps += (1.0 / max(dt, 1e-3) - fps) * 0.05
            img = frame.image
            h, w = img.shape[:2]
            hands = tracker.detect(img, int(now * 1000))
            landmarks = [hh.landmarks for hh in hands]
            label, conf = classify(landmarks, spec)
            if forced is not None:
                label, conf = forced, 1.0
            active, charge = state.update(label, conf, now, dt, spec)
            comp.reset(img)

            def anchor(
                hand: list[dict[str, float]], fw: int = w, fh: int = h
            ) -> tuple[float, float, float]:
                xs = [hand[i]["x"] for i in (5, 9, 13, 17)]
                ys = [hand[i]["y"] for i in (5, 9, 13, 17)]
                size = (
                    ((hand[12]["x"] - hand[0]["x"]) ** 2 + (hand[12]["y"] - hand[0]["y"]) ** 2)
                    ** 0.5
                    * fw
                )
                return (sum(xs) / 4 * fw, sum(ys) / 4 * fh, max(20.0, size))

            if active and landmarks:
                cx, cy, size = anchor(landmarks[0])
                if active == "rasengan":
                    render_rasengan(comp.canvas, cx, cy, size, now, charge, rng)
                elif active == "chidori":
                    render_chidori(comp.canvas, cx, cy, size, now, charge, rng, frame_no)
                elif active == "katon":
                    katon_hold += dt
                    if katon_hold >= 0.5 and katon_progress is None:
                        katon_progress = 0.0
                    if katon_progress is not None:
                        katon_progress += dt / 1.6
                        render_katon(comp.canvas, cx, cy - size, size, katon_progress, now, rng)
                        if katon_progress >= 1.0:
                            katon_progress = None
                            katon_hold = 0.0
                elif active == "bunshin" and len(landmarks) == 2:
                    cx2, cy2, size2 = anchor(landmarks[1])
                    render_poof(comp.canvas, cx - size, cy, size * 2, 0.8, seed=1)
                    render_poof(comp.canvas, cx2 + size2, cy2, size2 * 2, 0.8, seed=2)
                    render_clone(comp.canvas, img, None, -size * 0.5)
            else:
                katon_hold = 0.0
                katon_progress = None
            comp.bloom()
            out = comp.frame()
            hud = f"{active or label} charge={charge:.2f} fps={fps:.0f} dropped={cam.dropped}"
            cv2.putText(out, hud, (10, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            if show:
                cv2.imshow("chakra", out)
                key = cv2.waitKey(1) & 0xFF
                if key == ord("q"):
                    break
                if key == ord("s"):
                    cv2.imwrite(f"chakra-{frame_no:05d}.png", out)
                if key == ord("0"):
                    forced = None
                for i, name in enumerate(["rasengan", "chidori", "katon", "bunshin"], start=1):
                    if key == ord(str(i)):
                        forced = name
            frame_no += 1
    finally:
        cam.stop()
        tracker.stop()
        if show:
            cv2.destroyAllWindows()
