import { describe, expect, it } from 'vitest';
import { LandmarkSmoother, OneEuroFilter } from '../src/filters/oneEuro';

describe('OneEuroFilter', () => {
  it('converges to a constant signal', () => {
    const f = new OneEuroFilter();
    let y = 0;
    for (let i = 0; i < 200; i++) y = f.filter(5, i / 30);
    expect(Math.abs(y - 5)).toBeLessThan(1e-3);
  });

  it('tracks a ramp without exploding', () => {
    const f = new OneEuroFilter();
    for (let i = 0; i < 60; i++) {
      const y = f.filter(i / 60, i / 30);
      expect(Number.isFinite(y)).toBe(true);
    }
  });
});

describe('LandmarkSmoother', () => {
  it('preserves landmark count and converges', () => {
    const s = new LandmarkSmoother();
    const pts = Array.from({ length: 21 }, () => ({ x: 1, y: 2, z: 3 }));
    let out = pts;
    for (let i = 0; i < 120; i++) out = s.smooth(pts, i / 30);
    expect(out).toHaveLength(21);
    expect(Math.abs((out[0]?.x ?? 0) - 1)).toBeLessThan(1e-3);
  });
});
