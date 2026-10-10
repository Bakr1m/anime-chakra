"""MLP export round-trip, shapes, determinism, train smoke test."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from chakralens.datasets.synth import generate_dataset, preset
from chakralens.training import mlp

FIXTURES = Path(__file__).resolve().parents[2] / "spec" / "fixtures"
EXPORTED = Path(__file__).resolve().parents[2] / "models-export" / "classifier.json"


def test_exported_shapes() -> None:
    model = mlp.load(EXPORTED)
    assert model["inputDim"] == 63
    assert model["hiddenDim"] == 64
    assert len(model["classes"]) == 7
    assert np.array(model["W1"]).shape == (63, 64)
    assert np.array(model["b1"]).shape == (64,)
    assert np.array(model["W2"]).shape == (64, 7)
    assert np.array(model["b2"]).shape == (7,)


def test_forward_probs_sum_to_one() -> None:
    model = mlp.load(EXPORTED)
    xs, _ = generate_dataset(n_per_class=2, seed=5)
    probs = mlp.forward(np.array(xs), model)
    assert probs.shape == (14, 7)
    assert np.allclose(probs.sum(axis=1), 1.0)


def test_forward_matches_committed_vectors() -> None:
    model = mlp.load(EXPORTED)
    doc = json.loads((FIXTURES / "mlp_vectors.json").read_text(encoding="utf-8"))
    for vec in doc["vectors"]:
        got = mlp.forward(np.array([vec["input"]]), model)[0]
        assert np.allclose(got, np.array(vec["probs"]), atol=1e-9)


def test_predict_seed_prototypes() -> None:
    model = mlp.load(EXPORTED)
    for name, want in [("rasengan", "rasengan"), ("chidori", "chidori"), ("fist", "fist")]:
        label, conf = mlp.predict(preset(name, seed=0), model)
        assert label == want, (name, label)
        assert conf > 0.5


def test_train_smoke(tmp_path: Path) -> None:
    xs, ys = generate_dataset(n_per_class=12, seed=11)
    model, metrics = mlp.train(xs, ys, seed=11, max_iter=50)
    assert metrics["accuracy"] > 0.5
    out = tmp_path / "classifier.json"
    mlp.save(model, out)
    reloaded = mlp.load(out)
    assert reloaded["classes"] == model["classes"]
