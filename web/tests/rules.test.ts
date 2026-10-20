import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { angleAt, extractHand, segmentsIntersect, type Landmark } from '../src/gestures/features';
import { classify, gateReport } from '../src/gestures/rules';
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

  it('checks every hand for one-hand signs', () => {
    // MediaPipe order is arbitrary: the signing hand may be at index 1
    const signing = load('rasengan')[0] as Landmark[];
    const other = load('fist')[0] as Landmark[];
    expect(classify([other, signing], getSpec())[0]).toBe('rasengan');
    expect(classify([signing, other], getSpec())[0]).toBe('rasengan');
  });

  it('gate report shows ok and the first failing gate', () => {
    expect(gateReport(load('rasengan'), getSpec())).toContain('ras:ok');
    expect(gateReport(load('chidori'), getSpec())).toContain('chid:ok');
    expect(gateReport(load('fist'), getSpec())).toContain('chid:fo=0.34/0.80');
    expect(gateReport([], getSpec())).toContain('ras:h1');
  });

  it('handles degenerate geometry', () => {
    expect(angleAt([0, 0, 0], [0, 0, 0], [0, 0, 0])).toBe(180);
    expect(segmentsIntersect([0, 0, 0], [1, 1, 0], [0, 1, 0], [1, 0, 0])).toBe(true);
    expect(segmentsIntersect([0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0])).toBe(false);
    expect(() => extractHand([])).toThrow();
  });
});
