"""Numpy additive compositor with multi-scale (Gaussian) bloom.

Reduced fidelity vs the web GLSL path by design: no shaders, no HDR
pipeline, just float32 layers + screen-space blur + clip. Documented in the
README rendering notes.
"""

from __future__ import annotations

import cv2
import numpy as np
from numpy.typing import NDArray


class Compositor:
    """Accumulates BGR float32 layers over a base frame."""

    def __init__(self, width: int, height: int) -> None:
        self.width = width
        self.height = height
        self.canvas = np.zeros((height, width, 3), dtype=np.float32)

    def reset(self, base_bgr: NDArray[np.uint8] | None = None) -> None:
        if base_bgr is None:
            self.canvas.fill(0.0)
        else:
            self.canvas = base_bgr.astype(np.float32) / 255.0

    def add(self, layer: NDArray[np.float32], weight: float = 1.0) -> None:
        from typing import cast as _cast

        h, w = layer.shape[:2]
        if (h, w) != (self.height, self.width):
            layer = _cast("NDArray[np.float32]", cv2.resize(layer, (self.width, self.height)))
        self.canvas += layer * weight

    def bloom(self, strength: float = 0.55, radius: int = 21) -> None:
        """Two-scale screen blend of blurred brights."""
        bright = np.clip(self.canvas - 0.55, 0.0, None)
        for k in (radius, radius * 3 + 1):
            ksize = int(k) | 1
            blurred = cv2.GaussianBlur(bright, (ksize, ksize), 0)
            self.canvas = 1.0 - (1.0 - self.canvas) * (1.0 - blurred * strength)

    def frame(self) -> NDArray[np.uint8]:
        from typing import cast as _cast

        return _cast("NDArray[np.uint8]", (np.clip(self.canvas, 0.0, 1.0) * 255.0).astype(np.uint8))


def disc_mask(size: int, radius_frac: float = 1.0) -> NDArray[np.float32]:
    """Soft disc alpha mask, size x size."""
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    c = (size - 1) / 2.0
    r = np.sqrt((xx - c) ** 2 + (yy - c) ** 2) / (c * radius_frac)
    return np.clip(1.0 - r, 0.0, 1.0).astype(np.float32)


def paste_add(
    canvas: NDArray[np.float32],
    sprite_bgr: NDArray[np.float32],
    center: tuple[float, float],
) -> None:
    """Additive paste of a float BGR sprite centered at (x, y)."""
    sh, sw = sprite_bgr.shape[:2]
    x, y = round(center[0] - sw / 2), round(center[1] - sh / 2)
    x, y = int(x), int(y)
    ch, cw = canvas.shape[:2]
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(cw, x + sw), min(ch, y + sh)
    if x1 <= x0 or y1 <= y0:
        return
    canvas[y0:y1, x0:x1] += sprite_bgr[y0 - y : y1 - y, x0 - x : x1 - x]
