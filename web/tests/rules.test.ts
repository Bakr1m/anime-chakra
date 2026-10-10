import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { angleAt, extractHand, segmentsIntersect, type Landmark } from '../src/gestures/features';
import { classify } from '../src/gestures/rules';
import { getSpec } from '../src/gestures/spec';

const DIR = join(__dirname, '..', '..', 'spec', 'fixtures');

function load(id: string): Landmark[][] {
  const doc = JSON.parse(readFileSync(join(DIR, `${id}.json`), 'utf-8')) as {
    samples: { landmarks: Landmark[] }[];
  };
  return doc.samples.map((s) => s.landmarks);
}

describe('rules', () => {
  it('fires each core jutsu on its fixture', () => {
    expect(classify(load('rasengan'), getSpec())[0]).toBe('rasengan');
    expect(classify(load('chidori'), getSpec())[0]).toBe('chidori');
    expect(classify(load('katon'), getSpec())[0]).toBe('katon');
    expect(classify(load('bunshin'), getSpec())[0]).toBe('bunshin');
  });

  it('rejects negatives', () => {
    expect(classify(load('open_palm'), getSpec())[0]).toBe('none');
    expect(classify(load('fist'), getSpec())[0]).toBe('none');
    expect(classify(load('tiger_single'), getSpec())[0]).toBe('none');
  });

  it('handles degenerate geometry', () => {
    expect(angleAt([0, 0, 0], [0, 0, 0], [0, 0, 0])).toBe(180);
    expect(segmentsIntersect([0, 0, 0], [1, 1, 0], [0, 1, 0], [1, 0, 0])).toBe(true);
    expect(segmentsIntersect([0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0])).toBe(false);
    expect(() => extractHand([])).toThrow();
  });
});
