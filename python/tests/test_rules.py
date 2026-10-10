"""Positive/negative tests for the four core-sign rules."""

from __future__ import annotations

from chakralens.datasets.synth import preset
from chakralens.gestures.rules import classify, load_spec

SPEC = load_spec()


def test_rasengan_positive() -> None:
    for seed in range(3):
        assert classify([preset("rasengan", seed=seed)], SPEC)[0] == "rasengan"


def test_chidori_positive() -> None:
    for seed in range(3):
        assert classify([preset("chidori", seed=seed)], SPEC)[0] == "chidori"


def test_katon_positive() -> None:
    a = preset("tiger", seed=1, wrist=(-40.0, 0.0))
    b = preset("tiger", seed=2, wrist=(40.0, 0.0))
    assert classify([a, b], SPEC)[0] == "katon"


def test_bunshin_positive_and_outranks_katon() -> None:
    a = preset("cross", seed=1, wrist=(-70.0, 30.0), rotate_deg=10.0)
    b = preset("cross", seed=2, wrist=(70.0, 30.0), rotate_deg=-30.0)
    assert classify([a, b], SPEC)[0] == "bunshin"


def test_negatives() -> None:
    assert classify([preset("open_palm", seed=0)], SPEC)[0] == "none"
    assert classify([preset("fist", seed=0)], SPEC)[0] == "none"
    # single tiger hand must not fire a one-hand jutsu
    assert classify([preset("tiger", seed=0)], SPEC)[0] == "none"
    # symmetric cross hands do not cross -> katon (documented overlap), never bunshin
    a = preset("cross", seed=1, wrist=(-40.0, 0.0))
    b = preset("cross", seed=2, wrist=(40.0, 0.0))
    assert classify([a, b], SPEC)[0] in ("katon", "none")
