"""Selfie segmentation via MediaPipe ImageSegmenter (optional pipeline)."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from numpy.typing import NDArray


def default_model_path() -> Path:
    return Path(__file__).resolve().parents[5] / "models" / "selfie_segmenter.tflite"


class Segmentation:
    def __init__(self, model_path: Path | None = None) -> None:
        self.model_path = model_path or default_model_path()
        if not self.model_path.exists():
            raise FileNotFoundError(
                f"{self.model_path} missing; run scripts/fetch-models.sh first"
            )
        self._segmenter: object | None = None
        self._frame = 0

    def start(self) -> None:
        import mediapipe as mp  # type: ignore[import-untyped]

        base = mp.tasks.BaseOptions(model_asset_path=str(self.model_path))
        options = mp.tasks.vision.ImageSegmenterOptions(
            base_options=base,
            running_mode=mp.tasks.vision.RunningMode.VIDEO,
            output_category_mask=True,
        )
        self._segmenter = mp.tasks.vision.ImageSegmenter.create_from_options(options)

    def mask(self, image_bgr: NDArray[np.uint8], timestamp_ms: int) -> NDArray[np.bool_] | None:
        """Person mask, updated every 2nd frame; None when unavailable."""
        import mediapipe as mp  # type: ignore[import-untyped]

        if self._segmenter is None:
            raise RuntimeError("segmenter not started")
        self._frame += 1
        if self._frame % 2 != 0:
            return None
        rgb = image_bgr[:, :, ::-1].copy()
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        segmenter = self._segmenter
        assert hasattr(segmenter, "segment_for_video")
        result = segmenter.segment_for_video(mp_image, timestamp_ms)  # type: ignore[union-attr]
        category = getattr(result, "category_mask", None)
        if category is None:
            return None
        from typing import cast as _cast

        arr = _cast("NDArray[np.float32]", np.array(category.numpy_view(), dtype=np.float32))
        h, w = image_bgr.shape[:2]
        if arr.shape != (h, w):
            import cv2

            arr = _cast("NDArray[np.float32]", cv2.resize(arr, (w, h)))
        return arr > 0.5

    def stop(self) -> None:
        closer = getattr(self._segmenter, "close", None)
        if callable(closer):
            closer()
        self._segmenter = None
