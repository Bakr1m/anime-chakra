"""Hysteresis state machine with charge and cooldown. Driven by spec/gestures.json."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class JutsuState:
    active_id: str | None = None
    charge: float = 0.0
    _match_streak: int = 0
    _release_streak: int = 0
    _candidate: str | None = None
    cooldown_until: dict[str, float] = field(default_factory=dict)

    def update(
        self,
        label: str,
        confidence: float,
        now: float,
        dt: float,
        spec: dict,
    ) -> tuple[str | None, float]:
        """Feed one frame. Returns (active_id, charge 0..1)."""
        rel = spec["reliability"]
        activate_n = int(rel["activateFrames"])
        release_n = int(rel["releaseFrames"])
        min_conf = float(rel["minConfidence"])
        charge_s = float(rel["chargeSeconds"])
        cooldowns = {j["id"]: float(j.get("cooldownSeconds", 0.0)) for j in spec["jutsu"]}

        confident = label != "none" and confidence >= min_conf
        if confident and self.cooldown_until.get(label, 0.0) > now:
            confident = False
            label = "none"

        if confident:
            assert label != "none"
            if self.active_id is None:
                if self._candidate == label:
                    self._match_streak += 1
                else:
                    self._candidate = label
                    self._match_streak = 1
                self._release_streak = 0
                if self._match_streak >= activate_n:
                    self.active_id = label
                    self._candidate = None
                    self._match_streak = 0
                    self.charge = 0.0
            elif self.active_id == label:
                self._release_streak = 0
        else:
            self._match_streak = 0
            self._candidate = None
            if self.active_id is not None:
                self._release_streak += 1
                if self._release_streak >= release_n:
                    cd = cooldowns.get(self.active_id, 0.0)
                    if cd > 0:
                        self.cooldown_until[self.active_id] = now + cd
                    self.active_id = None
                    self.charge = 0.0
                    self._release_streak = 0

        if self.active_id is not None and charge_s > 0:
            # ease-out ramp: charge += (1 - charge) * dt / tau
            tau = charge_s / 3.0
            self.charge += (1.0 - self.charge) * min(1.0, dt / tau)
            self.charge = min(self.charge, 1.0)
        elif self.active_id is None:
            self.charge = 0.0
        return (self.active_id, self.charge)
