"""Tests for hysteresis, charge ramp and cooldowns."""

from __future__ import annotations

import itertools

from chakralens.gestures.rules import load_spec
from chakralens.gestures.state_machine import JutsuState

SPEC = load_spec()
REL = SPEC["reliability"]


def feed(st: JutsuState, label: str, n: int, start: float = 0.0, dt: float = 1 / 30) -> tuple[float, float]:
    now = start
    out = (None, 0.0)
    for _ in range(n):
        now += dt
        r = st.update(label, 1.0 if label != "none" else 0.0, now, dt, SPEC)
        assert r[0] is None or isinstance(r[0], str)
        out = (now, r[1])
    active, _ = st.update(label, 1.0 if label != "none" else 0.0, now + dt, dt, SPEC)
    return active, out[1]  # type: ignore[return-value]


def test_activates_after_n_frames() -> None:
    st = JutsuState()
    dt = 1 / 30
    now = 0.0
    for i in range(REL["activateFrames"] - 1):
        now += dt
        active, _ = st.update("rasengan", 1.0, now, dt, SPEC)
        assert active is None, f"activated early on frame {i + 1}"
    now += dt
    active, _ = st.update("rasengan", 1.0, now, dt, SPEC)
    assert active == "rasengan"


def test_low_confidence_never_activates() -> None:
    st = JutsuState()
    dt = 1 / 30
    now = 0.0
    for _ in range(20):
        now += dt
        active, _ = st.update("rasengan", 0.5, now, dt, SPEC)
        assert active is None


def test_releases_after_m_frames() -> None:
    st = JutsuState()
    activate(st)
    dt = 1 / 30
    now = 10.0
    for i in range(REL["releaseFrames"] - 1):
        now += dt
        active, _ = st.update("none", 0.0, now, dt, SPEC)
        assert active == "rasengan", f"released early on frame {i + 1}"
    now += dt
    active, _ = st.update("none", 0.0, now, dt, SPEC)
    assert active is None


def activate(st: JutsuState) -> None:
    dt = 1 / 30
    now = 0.0
    for _ in range(REL["activateFrames"]):
        now += dt
        st.update("rasengan", 1.0, now, dt, SPEC)


def test_charge_ramps_to_one() -> None:
    st = JutsuState()
    activate(st)
    dt = 1 / 30
    now = 5.0
    charges = []
    for _ in range(120):
        now += dt
        _, c = st.update("rasengan", 1.0, now, dt, SPEC)
        charges.append(c)
    assert charges[-1] > 0.99
    assert all(b >= a - 1e-9 for a, b in itertools.pairwise(charges))


def test_cooldown_blocks_immediate_retrigger() -> None:
    st = JutsuState()
    activate(st)
    dt = 1 / 30
    now = 5.0
    # release (katon has 4 s cooldown; use katon for this test)
    st2 = JutsuState()
    now2 = 0.0
    for _ in range(REL["activateFrames"]):
        now2 += dt
        st2.update("katon", 1.0, now2, dt, SPEC)
    assert st2.active_id == "katon"
    for _ in range(REL["releaseFrames"]):
        now2 += dt
        st2.update("none", 0.0, now2, dt, SPEC)
    assert st2.active_id is None
    # immediate retrigger blocked by cooldown
    for _ in range(REL["activateFrames"]):
        now2 += dt
        active, _ = st2.update("katon", 1.0, now2, dt, SPEC)
        assert active is None
    # after cooldown it can fire again
    now2 += 5.0
    for _ in range(REL["activateFrames"]):
        now2 += dt
        st2.update("katon", 1.0, now2, dt, SPEC)
    assert st2.active_id == "katon"
    _ = (st, now)
