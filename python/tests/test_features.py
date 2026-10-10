"""Unit tests for feature extraction (spec/FEATURES.md)."""

from __future__ import annotations

import math

from chakralens.datasets.synth import make_hand, preset
from chakralens.gestures import features as F


def test_hand_size_is_wrist_to_middle_mcp() -> None:
    h = preset("open_palm", seed=0)
    f = F.extract_hand(h)
    pts = [F.to_point(p) for p in h]
    assert f.hand_size == math.hypot(pts[0][0] - pts[9][0], pts[0][1] - pts[9][1])


def test_straight_finger_extension_is_one() -> None:
    h = preset("open_palm", seed=0)
    f = F.extract_hand(h)
    for finger in ("index", "middle", "ring", "pinky"):
        assert f.extension[finger] == F.clamp(f.extension[finger], 0.9, 1.1)
        assert abs(f.extension[finger] - 1.0) < 0.05


def test_curl_reduces_extension_monotonically() -> None:
    prev = 2.0
    for c in (0.0, 0.3, 0.6, 1.0):
        h = make_hand(curl={"index": c}, seed=0)
        f = F.extract_hand(h)
        assert f.extension["index"] < prev
        prev = f.extension["index"]


def test_open_palm_features() -> None:
    f = F.extract_hand(preset("open_palm", seed=0))
    assert abs(f.openness - 1.0) < 0.05
    assert abs(f.palm_to_camera - 1.0) < 1e-9
    assert f.pointing_up > 0.9


def test_pointing_horizontal_after_rotation() -> None:
    f = F.extract_hand(preset("chidori", seed=0))
    assert f.pointing_horizontal > 0.9


def test_angle_at_degenerate_returns_180() -> None:
    p = (1.0, 2.0, 3.0)
    assert F.angle_at(p, p, p) == 180.0


def test_segments_intersect_square_diagonals() -> None:
    assert F.segments_intersect((0, 0, 0), (1, 1, 0), (0, 1, 0), (1, 0, 0))
    assert not F.segments_intersect((0, 0, 0), (1, 0, 0), (0, 1, 0), (1, 1, 0))


def test_wrong_landmark_count_raises() -> None:
    try:
        F.extract_hand([{"x": 0, "y": 0, "z": 0}])
    except ValueError:
        return
    raise AssertionError("expected ValueError")


def test_to_dict_round_trip_keys() -> None:
    d = F.extract_hand(preset("rasengan", seed=0)).to_dict()
    for key in ("handSize", "extension", "openness", "spreadMean", "palmToCamera", "pointingUp"):
        assert key in d
