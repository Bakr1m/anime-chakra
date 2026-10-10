import { describe, expect, it } from 'vitest';
import { demoHands, demoBackground } from '../src/demo/driver';
import { classify } from '../src/gestures/rules';
import { getSpec } from '../src/gestures/spec';
import { buildBolt } from '../src/jutsu/chidori/lightning';
import { mulberry32 } from '../src/render/clock';

describe('lightning determinism', () => {
  it('same seed gives identical bolts', () => {
    const a = buildBolt({ x: 0, y: 0 }, { x: 100, y: -50 }, mulberry32(7));
    const b = buildBolt({ x: 0, y: 0 }, { x: 100, y: -50 }, mulberry32(7));
    expect(a).toEqual(b);
  });

  it('different seeds differ', () => {
    const a = buildBolt({ x: 0, y: 0 }, { x: 100, y: -50 }, mulberry32(7));
    const b = buildBolt({ x: 0, y: 0 }, { x: 100, y: -50 }, mulberry32(8));
    expect(a).not.toEqual(b);
  });

  it('bolts start and end at the terminals', () => {
    const [main] = buildBolt({ x: 10, y: 20 }, { x: 90, y: 40 }, mulberry32(3), 4, 0.28, false);
    expect(main?.[0]).toEqual({ x: 10, y: 20 });
    expect(main?.[main.length - 1]).toEqual({ x: 90, y: 40 });
    expect(main?.length).toBe(2 ** 4 + 1);
  });
});

describe('demo driver', () => {
  it('maps fixture hands into normalized coords and animates', () => {
    const t0 = demoHands('rasengan', 1.0);
    const t1 = demoHands('rasengan', 2.0);
    expect(t0).toHaveLength(3);
    for (const hand of t0) {
      for (const p of hand) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(1);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(1);
      }
    }
    expect(t0).not.toEqual(t1);
    expect(demoHands('nope', 0)).toEqual([]);
  });

  it('demo hands classify as their jutsu (joint normalization)', () => {
    const spec = getSpec();
    for (const [id, want] of [
      ['rasengan', 'rasengan'],
      ['chidori', 'chidori'],
      ['katon', 'katon'],
      ['bunshin', 'bunshin'],
    ] as const) {
      expect(classify(demoHands(id, 1.0), spec)[0], id).toBe(want);
    }
  });

  it('builds a background texture', () => {
    const bg = demoBackground();
    expect(bg.w).toBe(640);
    expect(bg.texture.image.data.length).toBe(640 * 360 * 4);
    bg.texture.dispose();
  });
});
