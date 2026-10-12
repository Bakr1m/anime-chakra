import { describe, expect, it } from 'vitest';
import { mirrorHand, type DetectedHand } from '../src/vision/hands';

function hand(x: number, tag: 'Left' | 'Right'): DetectedHand {
  return {
    landmarks: Array.from({ length: 21 }, (_, i) => ({ x: x + i * 0.001, y: 0.5, z: 0 })),
    handedness: tag,
  };
}

describe('mirrorHand', () => {
  it('flips x and swaps handedness', () => {
    const out = mirrorHand(hand(0.2, 'Right'));
    expect(out.landmarks[0]?.x).toBeCloseTo(0.8, 9);
    expect(out.landmarks[0]?.y).toBe(0.5);
    expect(out.handedness).toBe('Left');
  });

  it('is an involution', () => {
    const h = hand(0.35, 'Left');
    const twice = mirrorHand(mirrorHand(h));
    expect(twice.landmarks[5]?.x).toBeCloseTo(h.landmarks[5]?.x ?? 0, 9);
    expect(twice.handedness).toBe('Left');
  });
});
