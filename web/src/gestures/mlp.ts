// Exported-classifier loader + forward pass. Must match
// python/src/chakralens/training/mlp.py exactly (parity-tested on
// spec/fixtures/mlp_vectors.json).
import classifierJson from '../../../models-export/classifier.json';
import type { Landmark } from './features';

export interface MlpModel {
  version: number;
  classes: string[];
  inputDim: number;
  hiddenDim: number;
  W1: number[][];
  b1: number[];
  W2: number[][];
  b2: number[];
}

function validate(m: MlpModel): void {
  if (m.inputDim !== 63 || m.hiddenDim !== 64 || m.classes.length !== 7) {
    throw new Error('bad classifier shape');
  }
}

let cached: MlpModel | null = null;

export function loadClassifier(): MlpModel {
  if (!cached) {
    cached = classifierJson as unknown as MlpModel;
    validate(cached);
  }
  return cached;
}

/** 63-dim wrist-centered, hand-size scaled input (mirrors synth.normalize). */
export function normalizeHand(hand: Landmark[]): number[] {
  const wrist = hand[0];
  if (!wrist || !hand[9]) throw new Error('need 21 landmarks');
  const size = Math.hypot(hand[9].x - wrist.x, hand[9].y - wrist.y) || 1e-6;
  const out: number[] = [];
  for (const p of hand) {
    out.push((p.x - wrist.x) / size, (p.y - wrist.y) / size, (p.z - wrist.z) / size);
  }
  return out;
}

export function forward(xs: number[][], model: MlpModel): number[][] {
  return xs.map((x) => {
    const hidden: number[] = [];
    for (let j = 0; j < model.hiddenDim; j++) {
      let s = model.b1[j] ?? 0;
      for (let i = 0; i < model.inputDim; i++) {
        s += (x[i] ?? 0) * (model.W1[i]?.[j] ?? 0);
      }
      hidden.push(Math.max(0, s));
    }
    const logits: number[] = [];
    for (let k = 0; k < model.classes.length; k++) {
      let s = model.b2[k] ?? 0;
      for (let j = 0; j < model.hiddenDim; j++) {
        s += (hidden[j] ?? 0) * (model.W2[j]?.[k] ?? 0);
      }
      logits.push(s);
    }
    const m = Math.max(...logits);
    const exps = logits.map((l) => Math.exp(l - m));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map((e) => e / sum);
  });
}

export function predict(hand: Landmark[], model?: MlpModel): [string, number] {
  const m = model ?? loadClassifier();
  const probs = forward([normalizeHand(hand)], m)[0];
  if (!probs) throw new Error('empty prediction');
  let best = 0;
  for (let i = 1; i < probs.length; i++) {
    if ((probs[i] ?? 0) > (probs[best] ?? 0)) best = i;
  }
  return [m.classes[best] ?? 'other', probs[best] ?? 0];
}
