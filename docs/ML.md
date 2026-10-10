# ML notes: synthetic-trained baseline + rules ensemble

## What the classifier is

A tiny MLP (63 inputs -> 64 ReLU -> 7 softmax) trained in
`python/src/chakralens/training/mlp.py` on **synthetic** hands from
parameterized finger-curl prototypes (`datasets/synth.py`) with
rotation/scale/noise augmentation. `chakralens train` writes
`models-export/classifier.json`; the web app runs the identical forward pass
in TypeScript (`web/src/gestures/mlp.ts`), pinned by
`spec/fixtures/mlp_vectors.json`.

Classes are single-hand views: `rasengan, chidori, tiger, cross, open, fist,
other`. `tiger`/`cross` are the per-hand parts of the two-hand seals; the
two-hand seals themselves (wrist distance, line crossing) stay rule-based.

## Honest metrics

`chakralens evaluate` (fresh seed, not the training seed):

- synthetic held-out accuracy: ~0.99 (see `docs/img/` for the committed run)
- real hands: **not measured** — there is no real dataset in this repo yet.

The confusion matrix is dominated by design: prototypes are far apart, so
near-perfect synthetic accuracy mostly proves the generator is
self-consistent, not that real hands classify well. Do not quote the
synthetic number as gesture-recognition accuracy.

## Ensemble rule

Per hand: rules and MLP vote. Agreement -> the label at max confidence.
Disagreement -> `none` unless one side clears `disagreeMinConfidence` (0.9)
from `spec/gestures.json`. Two-hand seals additionally require the geometric
rules (crossing/width), which the MLP never overrides.

## Getting real data

1. Film ~20 s per sign on your phone, one folder per label:
   `videos/rasengan/`, `videos/chidori/`, ...
2. `chakralens extract videos/ --out data/` (needs `models/`).
3. `chakralens train` picks up `data/` automatically; `chakralens evaluate`
   then reports a second, real-data accuracy line.
4. Or record in-app: press `R`, pick a label, hold the sign 3 s, download the
   JSON and drop it in `data/`.
