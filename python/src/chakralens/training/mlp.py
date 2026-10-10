"""Tiny MLP: sklearn training, JSON export, numpy forward pass.

The exported `models-export/classifier.json` is loaded by both the Python
CLI and the web app, which runs the same forward pass in TypeScript
(parity-tested on shared vectors).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np

CLASSES = ("rasengan", "chidori", "tiger", "cross", "open", "fist", "other")
HIDDEN = 64


def softmax(logits: np.ndarray) -> np.ndarray:
    m = logits - logits.max(axis=1, keepdims=True)
    e = np.exp(m)
    return e / e.sum(axis=1, keepdims=True)


def forward(xs: np.ndarray, model: dict[str, Any]) -> np.ndarray:
    """Same math as web/src/gestures/mlp.ts. xs: (n, 63) -> (n, 7) probs."""
    w1 = np.array(model["W1"], dtype=np.float64)
    b1 = np.array(model["b1"], dtype=np.float64)
    w2 = np.array(model["W2"], dtype=np.float64)
    b2 = np.array(model["b2"], dtype=np.float64)
    hidden = np.maximum(0.0, xs.astype(np.float64) @ w1 + b1)
    return softmax(hidden @ w2 + b2)


def train(
    xs: list[list[float]],
    ys: list[str],
    seed: int = 7,
    max_iter: int = 400,
) -> tuple[dict[str, Any], dict[str, float]]:
    """Train on synthetic data. Returns (model_json, metrics)."""
    from sklearn.neural_network import MLPClassifier  # type: ignore[import-untyped]

    x = np.array(xs, dtype=np.float64)
    label_to_idx = {c: i for i, c in enumerate(CLASSES)}
    y = np.array([label_to_idx[label] for label in ys])
    # stratified 80/20 split without sklearn's train_test_split (fewer deps paths)
    rng = np.random.default_rng(seed)
    idx = rng.permutation(len(x))
    cut = int(len(x) * 0.8)
    train_idx, test_idx = idx[:cut], idx[cut:]
    clf = MLPClassifier(
        hidden_layer_sizes=(HIDDEN,),
        activation="relu",
        max_iter=max_iter,
        random_state=seed,
    )
    clf.fit(x[train_idx], y[train_idx])
    model = {
        "version": 1,
        "classes": list(CLASSES),
        "inputDim": 63,
        "hiddenDim": HIDDEN,
        "W1": clf.coefs_[0].tolist(),
        "b1": clf.intercepts_[0].tolist(),
        "W2": clf.coefs_[1].tolist(),
        "b2": clf.intercepts_[1].tolist(),
    }
    pred = forward(x[test_idx], model).argmax(axis=1)
    acc = float((pred == y[test_idx]).mean())
    metrics = {"accuracy": acc, "n_train": float(len(train_idx)), "n_test": float(len(test_idx))}
    return model, metrics


def save(model: dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(model), encoding="utf-8")


def load(path: Path) -> dict[str, Any]:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    assert data["classes"] == list(CLASSES)
    assert data["inputDim"] == 63
    assert len(data["W1"]) == 63 and len(data["W1"][0]) == HIDDEN
    assert len(data["W2"]) == HIDDEN and len(data["W2"][0]) == len(CLASSES)
    return data


def predict(hand: list[dict[str, float]], model: dict[str, Any]) -> tuple[str, float]:
    """Single-hand prediction. Hand = 21 {x,y,z} landmarks."""
    from chakralens.datasets.synth import normalize

    probs = forward(np.array([normalize(hand)], dtype=np.float64), model)[0]
    best = int(probs.argmax())
    return (CLASSES[best], float(probs[best]))


def confusion_matrix(
    xs: list[list[float]], ys: list[str], model: dict[str, Any]
) -> list[list[int]]:
    label_to_idx = {c: i for i, c in enumerate(CLASSES)}
    pred = forward(np.array(xs, dtype=np.float64), model).argmax(axis=1)
    n = len(CLASSES)
    mat = [[0] * n for _ in range(n)]
    for t, p in zip([label_to_idx[y] for y in ys], pred):
        mat[int(t)][int(p)] += 1
    return mat


def format_matrix(mat: list[list[int]]) -> str:
    width = max(5, max(len(str(v)) for row in mat for v in row) + 1)
    head = " " * (max(len(c) for c in CLASSES) + 1) + "".join(c[:width].rjust(width) for c in CLASSES)
    lines = [head]
    for cls, row in zip(CLASSES, mat):
        lines.append(cls.ljust(max(len(c) for c in CLASSES) + 1) + "".join(str(v).rjust(width) for v in row))
    return "\n".join(lines)

