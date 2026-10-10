"""OpenCV Kage Bunshin: noise-alpha poofs + masked clone offsets."""

from __future__ import annotations

import cv2
import numpy as np
from numpy.typing import NDArray

from .compositor import paste_add
from .noise import value_noise


def render_poof(
    canvas: NDArray[np.float32],
    cx: float,
    cy: float,
    size: float,
    life: float,
    seed: int = 0,
) -> None:
    """White smoke puff; life 1 -> 0."""
    dim = max(8, int(size))
    noise = cv2.resize(value_noise(128, seed=seed), (dim, dim))
    yy, xx = np.mgrid[0:dim, 0:dim].astype(np.float32)
    c = dim / 2.0
    r = np.sqrt((xx - c) ** 2 + (yy - c) ** 2) / c
    edge = np.clip(1.0 - r - (noise - 0.5) * 0.9, 0.0, 1.0)
    alpha = (edge * max(0.0, life))[..., None]
    white = np.ones((dim, dim, 3), dtype=np.float32) * alpha
    paste_add(canvas, white, (cx, cy))


def render_clone(
    canvas: NDArray[np.float32],
    frame_bgr: NDArray[np.uint8],
    mask: NDArray[np.bool_] | None,
    dx: float,
    opacity: float = 0.85,
) -> None:
    """Offset ghost copy of the current frame, masked to the person."""
    h, w = canvas.shape[:2]
    shifted = np.roll(frame_bgr.astype(np.float32) / 255.0, int(dx), axis=1)
    if mask is not None:
        m = mask.astype(np.float32)[..., None]
    else:
        _yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        m = np.clip(1.0 - np.abs(xx - w / 2) / (w / 2), 0.0, 1.0)[..., None]
    gray = shifted.mean(axis=2, keepdims=True)
    mixed = shifted * 0.75 + gray * 0.25
    canvas += mixed * m * opacity * 1.15
