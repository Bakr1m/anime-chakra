"""OpenCV Chidori: recursive midpoint bolts via cv2.polylines at 3 widths."""

from __future__ import annotations

import math
import random

import cv2
import numpy as np
from numpy.typing import NDArray


def _midpoint(
    a: tuple[float, float],
    b: tuple[float, float],
    rng: random.Random,
    levels: int,
    jitter: float,
) -> list[tuple[float, float]]:
    pts = [a, b]
    for _ in range(levels):
        out = [pts[0]]
        for i in range(1, len(pts)):
            ax, ay = pts[i - 1]
            bx, by = pts[i]
            length = math.hypot(bx - ax, by - ay) or 1.0
            off = (rng.random() - 0.5) * 2.0 * length * jitter
            nx, ny = -(by - ay) / length, (bx - ax) / length
            out.append(((ax + bx) / 2 + nx * off, (ay + by) / 2 + ny * off))
            out.append((bx, by))
        pts = out
    return pts


def render_chidori(
    canvas: NDArray[np.float32],
    cx: float,
    cy: float,
    size: float,
    time: float,
    charge: float,
    rng: random.Random,
    frame: int = 0,
) -> None:
    # regenerate every 2-3 frames (~30 Hz flicker); seed advances deterministically
    seed = 1000 + frame // 2
    bolt_rng = random.Random(seed)
    reach = size * (1.6 + charge * 1.2)
    for deg in (65, 82, 98, 115, 250, 290):
        rad = math.radians(deg)
        dist = reach * (0.7 + bolt_rng.random() * 0.6)
        target = (cx + math.cos(rad) * dist, cy - math.sin(rad) * dist)
        pts = _midpoint((cx, cy), target, bolt_rng, 4, 0.28)
        arr = np.array(pts, dtype=np.int32)
        cv2.polylines(canvas, [arr], False, (1.0, 0.64, 0.3), 5, cv2.LINE_AA)  # glow #4DA3FF
        cv2.polylines(canvas, [arr], False, (1.0, 0.85, 0.6), 3, cv2.LINE_AA)
        cv2.polylines(canvas, [arr], False, (1.0, 0.95, 0.9), 1, cv2.LINE_AA)  # core #BFE9FF
    # gravity sparks
    for _ in range(2 + int(5 * charge)):
        x = cx + (rng.random() - 0.5) * size
        y = cy + (rng.random() - 0.5) * size
        cv2.circle(canvas, (int(x), int(y)), 1, (1.0, 0.9, 0.75), -1, cv2.LINE_AA)
    _ = time
