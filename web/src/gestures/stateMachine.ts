// Hysteresis state machine with charge and cooldown, driven by the spec.
import type { GestureSpec } from './spec';

export class JutsuState {
  activeId: string | null = null;
  charge = 0;
  cooldownUntil: Record<string, number> = {};
  private matchStreak = 0;
  private releaseStreak = 0;
  private candidate: string | null = null;

  update(label: string, confidence: number, now: number, dt: number, spec: GestureSpec): [string | null, number] {
    const rel = spec.reliability;
    const confident =
      label !== 'none' && confidence >= rel.minConfidence && (this.cooldownUntil[label] ?? 0) <= now;
    const effLabel = confident ? label : 'none';

    if (confident) {
      if (this.activeId === null) {
        this.matchStreak = this.candidate === effLabel ? this.matchStreak + 1 : 1;
        this.candidate = effLabel;
        this.releaseStreak = 0;
        if (this.matchStreak >= rel.activateFrames) {
          this.activeId = effLabel;
          this.candidate = null;
          this.matchStreak = 0;
          this.charge = 0;
        }
      } else if (this.activeId === effLabel) {
        this.releaseStreak = 0;
      }
    } else {
      this.matchStreak = 0;
      this.candidate = null;
      if (this.activeId !== null) {
        this.releaseStreak += 1;
        if (this.releaseStreak >= rel.releaseFrames) {
          const cd = spec.jutsu.find((j) => j.id === this.activeId)?.cooldownSeconds ?? 0;
          if (cd > 0 && this.activeId !== null) this.cooldownUntil[this.activeId] = now + cd;
          this.activeId = null;
          this.charge = 0;
          this.releaseStreak = 0;
        }
      }
    }

    if (this.activeId !== null && rel.chargeSeconds > 0) {
      const tau = rel.chargeSeconds / 3;
      this.charge += (1 - this.charge) * Math.min(1, dt / tau);
      this.charge = Math.min(this.charge, 1);
    } else if (this.activeId === null) {
      this.charge = 0;
    }
    return [this.activeId, this.charge];
  }
}
