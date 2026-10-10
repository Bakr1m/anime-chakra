"""OpenCV Rasengan: polar-warped noise texture rotated per frame.

Reduced fidelity vs web (no shaders): a precomputed fBm tile is remapped
into a swirl each frame, tinted white -> #4FC3FF -> #1565C0, plus orbiting
dots. All additive on the compositor canvas (BGR float32).
"""

from __future__ import annotations

import math
import random

import cv2
import numpy as np
from numpy.typing import NDArray

from .compositor import disc_mask, paste_add
from .noise import fbm

_TILE: NDArray[np.float32] | None = None


def _tile(size: int = 256) -> NDArray[np.float32]:
    global _TILE
    if _TILE is None:
        _TILE = fbm(size)
    return _TILE


def render_rasengan(
    canvas: NDArray[np.float32],
    cx: float,
    cy: float,
    size: float,
    time: float,
    charge: float,
    rng: random.Random,
) -> None:
    radius = max(4, int(size * 0.9 * (0.7 + 0.3 * charge)))
    dim = radius * 2
    tile = cv2.resize(_tile(), (dim, dim))
    # swirl: rotate noise around the center by time (fast spiral streaks)
    center = (dim / 2.0, dim / 2.0)
    rot = cv2.getRotationMatrix2D(center, math.degrees(time * 3.0) % 360.0, 1.0)
    swirled = cv2.warpAffine(tile, rot, (dim, dim), flags=cv2.INTER_LINEAR)
    yy, xx = np.mgrid[0:dim, 0:dim].astype(np.float32)
    dx, dy = xx - dim / 2.0, yy - dim / 2.0
    r = np.sqrt(dx * dx + dy * dy) / (dim / 2.0)
    streaks = np.clip((swirled - 0.35) / 0.55, 0.0, 1.0)
    lanes = np.clip((0.6 - swirled) / 0.45, 0.0, 1.0)
    body = np.clip(1.0 - r, 0.0, 1.0)
    core = np.clip(1.0 - r, 0.0, 1.0) ** 4
    white = np.clip(core * 0.7 + streaks * 0.18, 0.0, 1.0) * body
    mid = body * (1.0 - lanes * 0.65)
    # BGR: edge #1565C0 -> mid #4FC3FF -> white core
    sprite = np.zeros((dim, dim, 3), dtype=np.float32)
    sprite[:, :, 0] = body * 0.75 + mid * 0.25 + white  # B
    sprite[:, :, 1] = body * 0.39 + mid * 0.37 + white  # G
    sprite[:, :, 2] = body * 0.08 + mid * 0.23 + white  # R
    sprite *= disc_mask(dim)[..., None]
    sprite *= 0.45 + 0.4 * charge
    paste_add(canvas, sprite, (cx, cy - size * 0.35))
    # orbiting dots on tight shells
    n = 8 + int(10 * charge)
    for _ in range(n):
        a = rng.random() * math.tau
        rr = radius * (0.75 + rng.random() * 0.45)
        x = cx + math.cos(a) * rr
        y = cy - size * 0.35 + math.sin(a) * rr
        cv2.circle(canvas, (int(x), int(y)), 2, (1.0, 0.7, 0.4), -1, cv2.LINE_AA)
