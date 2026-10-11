"""MediaPipe HandLandmarker over the shared models/ directory."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
from numpy.typing import NDArray

MODEL_NAMES = ("hand_landmarker.task",)


@dataclass
class DetectedHand:
    landmarks: list[dict[str, float]]
    handedness: str


def default_model_path() -> Path:
    return Path(__file__).resolve().parents[4] / "models" / "hand_landmarker.task"


class HandTracker:
    """Thin wrapper; raises FileNotFoundError when the model is absent."""

    def __init__(self, model_path: Path | None = None) -> None:
        self.model_path = model_path or default_model_path()
        if not self.model_path.exists():
            raise FileNotFoundError(
                f"{self.model_path} missing; run scripts/fetch-models.sh first"
            )
        self._landmarker: object | None = None

    def start(self) -> None:
        import mediapipe as mp

        base = mp.tasks.BaseOptions(model_asset_path=str(self.model_path))
        options = mp.tasks.vision.HandLandmarkerOptions(
            base_options=base,
            running_mode=mp.tasks.vision.RunningMode.VIDEO,
            num_hands=2,
        )
        self._landmarker = mp.tasks.vision.HandLandmarker.create_from_options(options)

    def detect(self, image_bgr: NDArray[np.uint8], timestamp_ms: int) -> list[DetectedHand]:
        import mediapipe as mp

        if self._landmarker is None:
            raise RuntimeError("tracker not started")
        rgb = image_bgr[:, :, ::-1].copy()
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        landmarker = self._landmarker
        assert hasattr(landmarker, "detect_for_video")
        result = landmarker.detect_for_video(mp_image, timestamp_ms)
        out: list[DetectedHand] = []
        hands = getattr(result, "hand_landmarks", []) or []
        handed = getattr(result, "handedness", []) or []
        for i, landmarks in enumerate(hands):
            pts = [{"x": float(p.x), "y": float(p.y), "z": float(p.z)} for p in landmarks]
            name = "Left"
            if i < len(handed) and handed[i]:
                name = str(handed[i][0].category_name or "Left")
            out.append(DetectedHand(landmarks=pts, handedness=name))
        return out

    def stop(self) -> None:
        closer = getattr(self._landmarker, "close", None)
        if callable(closer):
            closer()
        self._landmarker = None
