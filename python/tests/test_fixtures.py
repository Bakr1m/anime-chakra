"""Fixture conformance: committed spec/fixtures/*.json must classify as labelled."""

from __future__ import annotations

import json
from pathlib import Path

from chakralens.gestures.features import extract_hand
from chakralens.gestures.rules import classify, load_spec

FIXTURES = Path(__file__).resolve().parents[2] / "spec" / "fixtures"
SPEC = load_spec()


def _load() -> list[dict]:
    docs = []
    for p in sorted(FIXTURES.glob("*.json")):
        doc = json.loads(p.read_text(encoding="utf-8"))
        if "samples" in doc:  # gesture fixtures only (see mlp_vectors.json)
            docs.append(doc)
    return docs


def test_fixture_count() -> None:
    docs = _load()
    assert len(docs) == 7


def test_fixtures_classify_as_labelled() -> None:
    for doc in _load():
        hands = [s["landmarks"] for s in doc["samples"]]
        label, _ = classify(hands, SPEC)
        assert label == doc["expectedLabel"], doc["id"]


def _close(a: object, b: object, tol: float = 1e-4) -> None:
    if isinstance(a, float) and isinstance(b, float):
        assert abs(a - b) <= tol, f"{a} vs {b}"
    elif isinstance(a, dict) and isinstance(b, dict):
        assert set(a.keys()) == set(b.keys())
        for k in a:
            _close(a[k], b[k], tol)
    elif isinstance(a, list) and isinstance(b, list):
        assert len(a) == len(b)
        for x, y in zip(a, b):
            _close(x, y, tol)
    else:
        assert a == b


def test_fixture_features_match_within_tolerance() -> None:
    for doc in _load():
        for sample in doc["samples"]:
            feat = extract_hand(sample["landmarks"])
            _close(feat.to_dict(), sample["features"])
