"""Threaded webcam capture with latest-frame semantics."""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass

import cv2
import numpy as np
from numpy.typing import NDArray


@dataclass
class Frame:
    image: NDArray[np.uint8]
    index: int
    captured_at: float


class ThreadedCamera:
    """Reads frames on a background thread; `read()` returns the newest frame."""

    def __init__(self, camera: int = 0, width: int = 1280, height: int = 720) -> None:
        self._cap = cv2.VideoCapture(camera)
        self._cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
        self._lock = threading.Lock()
        self._frame: Frame | None = None
        self._running = False
        self._thread: threading.Thread | None = None
        self.dropped = 0

    @property
    def opened(self) -> bool:
        return self._cap.isOpened()

    def start(self) -> ThreadedCamera:
        if not self.opened:
            raise RuntimeError("camera did not open")
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()
        return self

    def _loop(self) -> None:
        index = 0
        while self._running:
            ok, img = self._cap.read()
            if not ok or img is None:
                time.sleep(0.005)
                continue
            from typing import cast as _cast

            with self._lock:
                if self._frame is not None:
                    self.dropped += 1
                frame_img = _cast("NDArray[np.uint8]", img)
                self._frame = Frame(image=frame_img, index=index, captured_at=time.time())
            index += 1

    def read(self) -> Frame | None:
        with self._lock:
            frame, self._frame = self._frame, None
        return frame

    def stop(self) -> None:
        self._running = False
        if self._thread is not None:
            self._thread.join(timeout=2.0)
        self._cap.release()
