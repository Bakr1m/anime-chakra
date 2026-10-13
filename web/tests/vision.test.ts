import { describe, expect, it } from 'vitest';
import { extractHand } from '../src/gestures/features';
import { HandTracker, toLandmarks } from '../src/vision/hands';

// Real MediaPipe Tasks shape: NormalizedLandmark objects, NOT arrays.
// A previous bug indexed them as arrays, collapsing every point to origin
// (telemetry fingerprint: open=0, all ext=0, palm=1.00). These tests pin it.
function apiHand(): { x: number; y: number; z: number }[] {
  return Array.from({ length: 21 }, (_, i) => ({
    x: 0.4 + (i % 5) * 0.02,
    y: 0.5 - Math.floor(i / 5) * 0.05,
    z: -0.01 * i,
  }));
}

describe('toLandmarks', () => {
  it('preserves object-form landmarks (real API shape)', () => {
    const pts = toLandmarks(apiHand());
    expect(pts).toHaveLength(21);
    expect(pts[0]).toEqual({ x: 0.4, y: 0.5, z: -0 });
    expect(pts[4]?.x).toBeCloseTo(0.48, 9);
  });

  it('still accepts array form defensively', () => {
    const pts = toLandmarks([
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6],
    ]);
    expect(pts[0]).toEqual({ x: 0.1, y: 0.2, z: 0.3 });
    expect(pts[1]).toEqual({ x: 0.4, y: 0.5, z: 0.6 });
  });
});

describe('HandTracker.detect', () => {
  it('returns non-degenerate hands from object-form results', () => {
    const tracker = new HandTracker();
    (tracker as unknown as { landmarker: unknown }).landmarker = {
      detectForVideo: () => ({
        landmarks: [apiHand()],
        handedness: [[{ categoryName: 'Right' }]],
      }),
      close: () => undefined,
    };
    const hands = tracker.detect({} as HTMLVideoElement, 1000);
    expect(hands).toHaveLength(1);
    expect(hands[0]?.handedness).toBe('Right');
    const feat = extractHand(hands[0]?.landmarks ?? []);
    expect(feat.openness).toBeGreaterThan(0);
    expect(feat.pointingHorizontal + feat.pointingUp).toBeGreaterThan(0);
  });

  it('returns empty when the landmarker finds nothing', () => {
    const tracker = new HandTracker();
    (tracker as unknown as { landmarker: unknown }).landmarker = {
      detectForVideo: () => ({ landmarks: [], handedness: [] }),
      close: () => undefined,
    };
    expect(tracker.detect({} as HTMLVideoElement, 1000)).toEqual([]);
  });
});
