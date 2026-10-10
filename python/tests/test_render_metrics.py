"""Headless OpenCV renderer metric tests: hue, luminance, animation."""

from __future__ import annotations

import random

import cv2
import numpy as np

from chakralens.render.bunshin import render_clone, render_poof
from chakralens.render.chidori import render_chidori
from chakralens.render.compositor import Compositor
from chakralens.render.katon import render_katon
from chakralens.render.rasengan import render_rasengan

W, H = 320, 240


def _stats(img: np.ndarray) -> tuple[float, float, float]:
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    luma = img.mean() / 255.0
    bright = hsv[:, :, 2] > 60
    frac = float(bright.mean())
    hue = float(np.median(hsv[:, :, 0][bright])) if frac > 0 else 0.0
    return hue, luma, frac


def _frames(draw) -> tuple[np.ndarray, np.ndarray]:  # type: ignore[no-untyped-def]
    rng = random.Random(11)
    comp = Compositor(W, H)
    comp.reset()
    draw(comp.canvas, 0.0, rng)
    comp.bloom()
    a = comp.frame()
    comp.reset()
    draw(comp.canvas, 0.5, rng)
    comp.bloom()
    b = comp.frame()
    return a, b


def test_rasengan_hue_luma_motion() -> None:
    def draw(canvas: object, t: float, rng: random.Random) -> None:
        render_rasengan(canvas, W / 2, H / 2, 80.0, t, 1.0, rng)  # type: ignore[arg-type]

    a, b = _frames(draw)
    hue, luma, frac = _stats(a)
    assert 85 <= hue <= 115, hue  # OpenCV hue: cyan-blue ~90-110
    assert frac > 0.005, frac
    assert luma > 0.01
    assert np.abs(a.astype(float) - b.astype(float)).mean() > 0.5


def test_chidori_hue_luma_motion() -> None:
    def draw(canvas: object, t: float, rng: random.Random) -> None:
        render_chidori(canvas, W / 2, H / 2, 60.0, t, 1.0, rng, int(t * 30))  # type: ignore[arg-type]

    a, b = _frames(draw)
    hue, luma, frac = _stats(a)
    assert 85 <= hue <= 130, hue
    assert frac > 0.003, frac
    assert luma > 0.01
    assert np.abs(a.astype(float) - b.astype(float)).mean() > 0.2


def test_katon_hue_luma_motion() -> None:
    def draw(canvas: object, t: float, rng: random.Random) -> None:
        render_katon(canvas, W / 2, H / 2, 60.0, 0.4 + t, t, rng)  # type: ignore[arg-type]

    a, b = _frames(draw)
    hsv = cv2.cvtColor(a, cv2.COLOR_BGR2HSV)
    red = ((hsv[:, :, 0] < 10) | (hsv[:, :, 0] > 160)) & (hsv[:, :, 1] > 80)
    assert red.mean() > 0.002
    assert a.mean() / 255.0 > 0.005
    assert np.abs(a.astype(float) - b.astype(float)).mean() > 0.2


def test_bunshin_poof_and_clone() -> None:
    rng = random.Random(3)
    comp = Compositor(W, H)
    comp.reset()
    frame = np.zeros((H, W, 3), dtype=np.uint8)
    cv2.circle(frame, (W // 2, H // 2), 30, (180, 170, 160), -1)
    render_poof(comp.canvas, W / 2, H / 2, 80.0, 1.0, seed=5)
    comp.bloom()
    a = comp.frame()
    assert a.mean() > 5.0
    comp2 = Compositor(W, H)
    comp2.reset()
    render_clone(comp2.canvas, frame, None, -40.0)
    out = comp2.frame()
    assert out.mean() > 1.0
    _ = rng
