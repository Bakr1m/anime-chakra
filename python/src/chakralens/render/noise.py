"""Cheap CPU value-noise helpers (the OpenCV renderer's fBm stand-in)."""

from __future__ import annotations

import cv2
import numpy as np
from numpy.typing import NDArray


def value_noise(size: int, seed: int = 0) -> NDArray[np.float32]:
    """Smooth 2D noise in [0, 1] via blurred white noise (seeded)."""
    rng = np.random.default_rng(seed)
    from typing import cast as _cast

    white = rng.random((size, size), dtype=np.float32)
    return _cast("NDArray[np.float32]", cv2.GaussianBlur(white, (0, 0), size / 24.0))


def fbm(size: int, octaves: int = 4, seed: int = 0) -> NDArray[np.float32]:
    """Fractal sum of value noise octaves, normalized to [0, 1]."""
    acc = np.zeros((size, size), dtype=np.float32)
    amp, freq_seed, total = 0.5, seed, 0.0
    for _ in range(octaves):
        layer = value_noise(size, seed=freq_seed)
        acc += amp * layer
        total += amp
        amp *= 0.5
        freq_seed += 101
    return (acc / total).astype(np.float32)
