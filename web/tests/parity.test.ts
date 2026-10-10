// Parity: web must match python on all shared fixtures (labels + features 1e-4).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractHand, twoHandFeatures, type Landmark } from '../src/gestures/features';
import { classify } from '../src/gestures/rules';
import { getSpec } from '../src/gestures/spec';

const DIR = join(__dirname, '..', '..', 'spec', 'fixtures');
const TOL = 1e-4;

function close(a: unknown, b: unknown, path = ''): void {
  if (typeof a === 'number' && typeof b === 'number') {
    expect(Math.abs(a - b), path).toBeLessThanOrEqual(TOL);
  } else if (Array.isArray(a) && Array.isArray(b)) {
    expect(a.length, path).toBe(b.length);
    a.forEach((x, i) => close(x, b[i], `${path}[${i}]`));
  } else if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ra = a as Record<string, unknown>;
    const rb = b as Record<string, unknown>;
    expect(Object.keys(ra).sort(), path).toEqual(Object.keys(rb).sort());
    for (const k of Object.keys(ra)) close(ra[k], rb[k], `${path}.${k}`);
  } else {
    expect(a).toBe(b);
  }
}

const files = readdirSync(DIR).filter(
  (f) => f.endsWith('.json') && f !== 'mlp_vectors.json',
);

describe('parity with python fixtures', () => {
  it('has fixtures', () => {
    expect(files.length).toBeGreaterThanOrEqual(7);
  });

  for (const file of files) {
    it(`${file}: label matches`, () => {
      const doc = JSON.parse(readFileSync(join(DIR, file), 'utf-8')) as {
        expectedLabel: string;
        samples: { landmarks: Landmark[] }[];
      };
      const hands = doc.samples.map((s) => s.landmarks);
      expect(classify(hands, getSpec())[0]).toBe(doc.expectedLabel);
    });

    it(`${file}: features match within 1e-4`, () => {
      const doc = JSON.parse(readFileSync(join(DIR, file), 'utf-8')) as {
        samples: { landmarks: Landmark[]; features: unknown }[];
      };
      for (const s of doc.samples) {
        close(extractHand(s.landmarks), s.features);
      }
    });

    it(`${file}: two-hand features match within 1e-4`, () => {
      const doc = JSON.parse(readFileSync(join(DIR, file), 'utf-8')) as {
        samples: { landmarks: Landmark[] }[];
        twoHand?: unknown;
      };
      if (!doc.twoHand) return;
      const hands = doc.samples.map((s) => s.landmarks);
      close(
        twoHandFeatures(hands[0] as Landmark[], hands[1] as Landmark[]),
        doc.twoHand,
      );
    });
  }
});
