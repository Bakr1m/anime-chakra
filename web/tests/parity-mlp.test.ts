// Parity for the MLP forward pass + ensemble unit tests.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ensembleSingle, ensembleTwoHand } from '../src/gestures/ensemble';
import { forward, loadClassifier, normalizeHand, predict } from '../src/gestures/mlp';

const DIR = join(__dirname, '..', '..', 'spec', 'fixtures');

describe('mlp forward parity', () => {
  it('matches python probs within 1e-9', () => {
    const model = loadClassifier();
    const doc = JSON.parse(readFileSync(join(DIR, 'mlp_vectors.json'), 'utf-8')) as {
      vectors: { input: number[]; label: string; probs: number[] }[];
    };
    expect(doc.vectors.length).toBeGreaterThanOrEqual(8);
    for (const v of doc.vectors) {
      const got = forward([v.input], model)[0];
      expect(got?.length).toBe(7);
      got?.forEach((p, i) => {
        expect(Math.abs(p - (v.probs[i] ?? 0)), `vec ${v.label}[${i}]`).toBeLessThan(1e-9);
      });
      const sum = got?.reduce((a, b) => a + b, 0) ?? 0;
      expect(Math.abs(sum - 1)).toBeLessThan(1e-12);
    }
  });

  it('predicts seed prototypes', () => {
    const rasengan = JSON.parse(readFileSync(join(DIR, 'rasengan.json'), 'utf-8')) as {
      samples: { landmarks: { x: number; y: number; z: number }[] }[];
    };
    const hand = rasengan.samples[0]?.landmarks;
    if (!hand) throw new Error('no fixture hand');
    expect(normalizeHand(hand)).toHaveLength(63);
    expect(predict(hand)[0]).toBe('rasengan');
  });
});

describe('ensemble', () => {
  it('rules and MLP agree', () => {
    expect(ensembleSingle('rasengan', 1, 'rasengan', 0.9)).toEqual(['rasengan', 1]);
    expect(ensembleSingle('none', 0, 'open', 0.9)).toEqual(['none', 0.9]);
  });

  it('rules are the only activation authority', () => {
    // calibrated rules are never vetoed by the synthetic-only MLP
    expect(ensembleSingle('rasengan', 1, 'open', 0.5)).toEqual(['rasengan', 1]);
    expect(ensembleSingle('rasengan', 1, 'fist', 0.95)).toEqual(['rasengan', 1]);
    expect(ensembleSingle('chidori', 1, 'other', 0.99)).toEqual(['chidori', 1]);
    // and a confident synthetic MLP cannot activate a sign alone
    expect(ensembleSingle('none', 0, 'rasengan', 0.95)).toEqual(['none', 0]);
    expect(ensembleSingle('none', 0, 'chidori', 0.99)).toEqual(['none', 0]);
  });

  it('two-hand parts confirm', () => {
    expect(ensembleTwoHand('katon', ['tiger', 'tiger'], 1)).toEqual(['katon', 1]);
    expect(ensembleTwoHand('katon', ['tiger', 'open'], 1)).toEqual(['katon', 0.8]);
    expect(ensembleTwoHand('bunshin', ['cross', 'cross'], 1)).toEqual(['bunshin', 1]);
  });
});
