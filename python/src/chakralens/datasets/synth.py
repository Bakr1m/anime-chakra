"""Parametric synthetic hand-landmark generator.

Builds 21 MediaPipe-ordered landmarks from finger-curl prototypes. Used for
unit tests, spec fixtures, and the synthetic-trained MLP baseline (Phase 10).
Deterministic given a seed. Coordinates are in arbitrary image-like units
(x right, y down, z depth); only ratios matter downstream.
"""

from __future__ import annotations

import math
import random

# Finger segment lengths (proximal, middle, distal) in hand-size units.
SEGMENTS: dict[str, tuple[float, float, float]] = {
    "thumb": (0.40, 0.30, 0.25),
    "index": (0.45, 0.30, 0.25),
    "middle": (0.48, 0.32, 0.26),
    "ring": (0.44, 0.30, 0.25),
    "pinky": (0.34, 0.24, 0.22),
}

# MCP base positions (x across palm, y along hand) in hand-size units.
MCP_BASE: dict[str, tuple[float, float]] = {
    "thumb": (0.52, 0.30),
    "index": (0.36, 1.00),
    "middle": (0.12, 1.06),
    "ring": (-0.12, 1.00),
    "pinky": (-0.33, 0.88),
}

FINGER_ORDER = ("thumb", "index", "middle", "ring", "pinky")


def _rot2(x: float, y: float, ang: float) -> tuple[float, float]:
    c, s = math.cos(ang), math.sin(ang)
    return (x * c - y * s, x * s + y * c)


def make_hand(
    curl: dict[str, float] | None = None,
    spread: float = 1.0,
    rotate_deg: float = 0.0,
    wrist: tuple[float, float] = (0.0, 0.0),
    scale: float = 100.0,
    curl_jitter: float = 0.0,
    seed: int = 0,
) -> list[dict[str, float]]:
    """Build one 21-landmark hand.

    curl: per-finger 0 (straight) .. 1 (full fist). Missing fingers default 0.
    spread: scales across-palm (x) offsets of fingertips around the middle axis.
    rotate_deg: in-plane rotation applied about the wrist (image plane).
    wrist: wrist (x, y) center in output units. scale: hand-size in output units.
    """
    rng = random.Random(seed)
    curl = dict(curl or {})
    pts: list[tuple[float, float, float]] = [(0.0, 0.0, 0.0)] * 21
    pts[0] = (wrist[0], wrist[1], 0.0)
    # Finger base: pointing up in image coords means -y.
    for name in FINGER_ORDER:
        c = min(1.0, max(0.0, curl.get(name, 0.0) + rng.uniform(-curl_jitter, curl_jitter)))
        bx, by = MCP_BASE[name]
        if name == "thumb":
            # Thumb points out sideways; curl folds it across the palm.
            base_ang = math.radians(130 - 25 * (1.0 - c))
        else:
            base_ang = 0.0  # straight up (-y in image coords)
        # Flex accumulates along joints; tips swing toward the palm.
        flex_total = c * math.radians(230)
        l1, l2, l3 = SEGMENTS[name]
        joints = [base_ang + flex_total * 0.35, base_ang + flex_total * 0.75, base_ang + flex_total * 1.1]
        lens = [l1, l2, l3]
        # MCP index map
        mcp_idx = {"thumb": 1, "index": 5, "middle": 9, "ring": 13, "pinky": 17}[name]
        mcp = (wrist[0] + bx * scale, wrist[1] - by * scale, 0.0)
        pts[mcp_idx] = mcp
        x, y = mcp[0] - wrist[0], mcp[1] - wrist[1]
        cx, cy = wrist[0], wrist[1]
        px, py = mcp[0], mcp[1]
        for k, (ang, ln) in enumerate(zip(joints, lens)):
            dx = math.sin(ang) * ln * scale
            dy = -math.cos(ang) * ln * scale
            # spread: push fingertip x away from hand axis proportionally
            qx, qy = px + dx, py + dy
            if name != "thumb" and k == 2:
                qx = mcp[0] + (qx - mcp[0]) * spread
            px, py = qx, qy
            pts[mcp_idx + k + 1] = (px, py, -c * 0.15 * scale * (k + 1) / 3.0)
        _ = (x, y, cx, cy)
    # In-plane rotation about wrist.
    ang = math.radians(rotate_deg)
    out: list[dict[str, float]] = []
    for (x, y, z) in pts:
        rx, ry = _rot2(x - wrist[0], y - wrist[1], ang)
        out.append({"x": wrist[0] + rx, "y": wrist[1] + ry, "z": z})
    return out


def preset(name: str, seed: int = 0, **kw: object) -> list[dict[str, float]]:
    """Named prototypes matching the four core signs (plus negatives)."""
    if name == "rasengan":
        return make_hand(
            curl={"thumb": 0.55, "index": 0.5, "middle": 0.55, "ring": 0.55, "pinky": 0.6},
            spread=0.55,
            seed=seed,
            **kw,  # type: ignore[arg-type]
        )
    if name == "chidori":
        return make_hand(
            curl={"thumb": 1.0, "index": 0.0, "middle": 0.0, "ring": 0.0, "pinky": 0.05},
            spread=0.45,
            rotate_deg=80.0,
            seed=seed,
            **kw,  # type: ignore[arg-type]
        )
    if name == "open_palm":
        return make_hand(curl={}, spread=1.0, seed=seed, **kw)  # type: ignore[arg-type]
    if name == "fist":
        return make_hand(
            curl={f: 1.0 for f in FINGER_ORDER}, spread=0.7, seed=seed, **kw  # type: ignore[arg-type]
        )
    if name == "tiger":
        return make_hand(
            curl={"thumb": 0.9, "index": 0.0, "middle": 0.0, "ring": 1.0, "pinky": 1.0},
            spread=0.4,
            seed=seed,
            **kw,  # type: ignore[arg-type]
        )
    if name == "cross":
        return make_hand(
            curl={"thumb": 1.0, "index": 0.0, "middle": 0.0, "ring": 1.0, "pinky": 1.0},
            spread=0.5,
            seed=seed,
            **kw,  # type: ignore[arg-type]
        )
    raise KeyError(name)
