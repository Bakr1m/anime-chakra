"""OpenCV Katon: noise-driven flame ramp in a growing disc + embers."""

from __future__ import annotations

import random

import cv2
import numpy as np
from numpy.typing import NDArray

from .compositor import disc_mask, paste_add
from .noise import fbm

_TILE: NDArray[np.float32] | None = None


def render_katon(
    canvas: NDArray[np.float32],
    cx: float,
    cy: float,
    head_px: float,
    progress: float,
    time: float,
    rng: random.Random,
) -> None:
    """progress 0..1 across the 1.6 s flight."""
    global _TILE
    if _TILE is None:
        _TILE = fbm(256)
    k = min(1.0, max(0.0, progress))
    size = head_px * (0.3 + 1.7 * k)
    dim = max(8, int(size))
    tile = cv2.resize(_TILE, (dim, dim))
    # scroll the noise upward for rising flames
    shift = int(time * 60) % dim
    scrolled = np.roll(tile, -shift, axis=0)
    yy, _xx = np.mgrid[0:dim, 0:dim].astype(np.float32)
    r = np.sqrt(((np.arange(dim) - dim / 2.0) ** 2)[None, :] + ((yy[:, 0] - dim / 2.0) ** 2)[:, None])
    r = r / (dim / 2.0)
    heat = np.clip(1.0 - r + (scrolled - 0.5) * 1.1, 0.0, 1.0)
    sprite = np.zeros((dim, dim, 3), dtype=np.float32)
    # BGR ramp black -> deep red -> orange #FF6A00 -> yellow -> white
    sprite[:, :, 0] = np.clip(heat * 1.6 - 0.6, 0, 1) * 0.4  # B
    sprite[:, :, 1] = np.clip(heat * 1.5 - 0.35, 0, 1) * 0.75  # G
    sprite[:, :, 2] = np.clip(heat * 1.7, 0, 1)  # R
    sprite *= disc_mask(dim)[..., None]
    paste_add(canvas, sprite * 1.6, (cx, cy - k * head_px * 0.6))
    for _ in range(4):
        x = cx + (rng.random() - 0.5) * size
        y = cy + (rng.random() - 0.5) * size * 0.5 - k * head_px * 0.6
        cv2.circle(canvas, (int(x), int(y)), 1, (0.1, 0.5 + rng.random() * 0.3, 1.0), -1)
