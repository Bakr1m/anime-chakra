"""Hand feature extraction per spec/FEATURES.md. Pure math, no I/O."""

from __future__ import annotations

import math
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any

EPS = 1e-6

FINGERS: dict[str, tuple[int, int, int, int]] = {
    "thumb": (1, 2, 3, 4),
    "index": (5, 6, 7, 8),
    "middle": (9, 10, 11, 12),
    "ring": (13, 14, 15, 16),
    "pinky": (17, 18, 19, 20),
}

Point = tuple[float, float, float]


Landmark = Mapping[str, Any] | Sequence[Any]


def to_point(p: Landmark) -> Point:
    """Accept dicts {x,y,z} or sequences."""
    if isinstance(p, Mapping):
        return (float(p["x"]), float(p["y"]), float(p["z"]))
    seq = list(p)
    return (float(seq[0]), float(seq[1]), float(seq[2]))


def dist2(a: Point, b: Point) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def dist3(a: Point, b: Point) -> float:
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(v, hi))


def angle_at(a: Point, b: Point, c: Point) -> float:
    """Angle ABC in degrees. Degenerate arms yield 180.0."""
    ax, ay, az = a[0] - b[0], a[1] - b[1], a[2] - b[2]
    cx, cy, cz = c[0] - b[0], c[1] - b[1], c[2] - b[2]
    la = math.sqrt(ax * ax + ay * ay + az * az)
    lc = math.sqrt(cx * cx + cy * cy + cz * cz)
    if la < EPS or lc < EPS:
        return 180.0
    cosv = clamp((ax * cx + ay * cy + az * cz) / (la * lc), -1.0, 1.0)
    return math.degrees(math.acos(cosv))


def cross(u: Point, v: Point) -> Point:
    return (
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
    )


def sub(a: Point, b: Point) -> Point:
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


@dataclass
class HandFeatures:
    hand_size: float
    palm_center: Point
    extension: dict[str, float] = field(default_factory=dict)
    curl: dict[str, float] = field(default_factory=dict)
    openness: float = 0.0
    spread_mean: float = 0.0
    palm_to_camera: float = 0.0
    pointing: Point = (0.0, 0.0, 0.0)
    pointing_up: float = 0.0
    pointing_horizontal: float = 0.0

    def to_dict(self) -> dict[str, object]:
        return {
            "handSize": self.hand_size,
            "palmCenter": list(self.palm_center),
            "extension": dict(self.extension),
            "curl": dict(self.curl),
            "openness": self.openness,
            "spreadMean": self.spread_mean,
            "palmToCamera": self.palm_to_camera,
            "pointing": list(self.pointing),
            "pointingUp": self.pointing_up,
            "pointingHorizontal": self.pointing_horizontal,
        }


def finger_extension(pts: list[Point], finger: str) -> float:
    mcp, pip, dip, tip = FINGERS[finger]
    straight = dist3(pts[mcp], pts[tip])
    chain = dist3(pts[mcp], pts[pip]) + dist3(pts[pip], pts[dip]) + dist3(pts[dip], pts[tip])
    return straight / (chain + EPS)


def finger_curl(pts: list[Point], finger: str) -> float:
    mcp, pip, _dip, tip = FINGERS[finger]
    return angle_at(pts[mcp], pts[pip], pts[tip])


def extract_hand(landmarks: Sequence[Landmark]) -> HandFeatures:
    """Extract features for one hand (21 landmarks)."""
    pts = [to_point(p) for p in landmarks]
    if len(pts) != 21:
        raise ValueError(f"expected 21 landmarks, got {len(pts)}")
    hand_size = max(dist2(pts[0], pts[9]), EPS)
    palm_center = (
        (pts[5][0] + pts[9][0] + pts[13][0] + pts[17][0]) / 4.0,
        (pts[5][1] + pts[9][1] + pts[13][1] + pts[17][1]) / 4.0,
        (pts[5][2] + pts[9][2] + pts[13][2] + pts[17][2]) / 4.0,
    )
    extension = {f: finger_extension(pts, f) for f in FINGERS}
    curl = {f: finger_curl(pts, f) for f in FINGERS}
    openness = float(
        sum(extension[f] for f in ("index", "middle", "ring", "pinky")) / 4.0
    )
    spreads = [
        dist2(pts[8], pts[12]) / hand_size,
        dist2(pts[12], pts[16]) / hand_size,
        dist2(pts[16], pts[20]) / hand_size,
    ]
    spread_mean = float(sum(spreads) / 3.0)
    u = sub(pts[5], pts[0])
    v = sub(pts[17], pts[0])
    n = cross(u, v)
    ln = math.sqrt(n[0] ** 2 + n[1] ** 2 + n[2] ** 2)
    if ln < EPS:
        n = (0.0, 0.0, -1.0)
    else:
        n = (n[0] / ln, n[1] / ln, n[2] / ln)
    if n[2] > 0:
        n = (-n[0], -n[1], -n[2])
    palm_to_camera = clamp(-n[2], 0.0, 1.0)
    w = sub(pts[12], pts[0])
    ln = math.sqrt(w[0] ** 2 + w[1] ** 2 + w[2] ** 2)
    pointing: Point = (0.0, 0.0, 0.0) if ln < EPS else (w[0] / ln, w[1] / ln, w[2] / ln)
    pointing_up = clamp(-pointing[1], -1.0, 1.0)
    pointing_horizontal = clamp(abs(pointing[0]), 0.0, 1.0)
    return HandFeatures(
        hand_size=hand_size,
        palm_center=palm_center,
        extension=extension,
        curl=curl,
        openness=openness,
        spread_mean=spread_mean,
        palm_to_camera=palm_to_camera,
        pointing=pointing,
        pointing_up=pointing_up,
        pointing_horizontal=pointing_horizontal,
    )


def _orient(a: Point, b: Point, c: Point) -> float:
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def segments_intersect(p1: Point, p2: Point, p3: Point, p4: Point) -> bool:
    """2D segment intersection via orientation test, epsilon 1e-9."""
    e = 1e-9
    d1 = _orient(p3, p4, p1)
    d2 = _orient(p3, p4, p2)
    d3 = _orient(p1, p2, p3)
    d4 = _orient(p1, p2, p4)
    opposing1 = (d1 > e and d2 < -e) or (d1 < -e and d2 > e)
    opposing2 = (d3 > e and d4 < -e) or (d3 < -e and d4 > e)
    return bool(opposing1 and opposing2)


def two_hand_features(a: Sequence[Landmark], b: Sequence[Landmark]) -> dict[str, float | bool]:
    """Order-independent two-hand features per FEATURES.md section 4."""
    pa = [to_point(p) for p in a]
    pb = [to_point(p) for p in b]
    fa = extract_hand(a)
    fb = extract_hand(b)
    mean_size = (fa.hand_size + fb.hand_size) / 2.0
    wrist_distance = dist2(pa[0], pb[0]) / mean_size
    ua = (pa[12][0] - pa[8][0], pa[12][1] - pa[8][1], 0.0)
    ub = (pb[12][0] - pb[8][0], pb[12][1] - pb[8][1], 0.0)
    la = math.hypot(ua[0], ua[1])
    lb = math.hypot(ub[0], ub[1])
    if la < EPS or lb < EPS:
        cross_angle = 0.0
    else:
        cosv = clamp((ua[0] * ub[0] + ua[1] * ub[1]) / (la * lb), -1.0, 1.0)
        d = math.degrees(math.acos(cosv))
        cross_angle = d if d <= 90.0 else 180.0 - d
    lines_cross = segments_intersect(pa[8], pa[12], pb[8], pb[12])
    relative_height = (pa[0][1] - pb[0][1]) / mean_size
    return {
        "wristDistance": wrist_distance,
        "crossAngle": cross_angle,
        "linesCross": lines_cross,
        "relativeHeight": relative_height,
    }
