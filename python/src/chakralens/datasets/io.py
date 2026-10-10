"""Schema-validated dataset I/O (JSON / JSONL landmark samples)."""

from __future__ import annotations

import json
from pathlib import Path

from chakralens.datasets.synth import normalize

VALID_LABELS = {
    "rasengan",
    "chidori",
    "katon",
    "bunshin",
    "sharingan",
    "kurama",
    "none",
    "other",
    "tiger",
    "cross",
    "open",
    "fist",
}

# MLP training classes (single-hand view of the world)
TRAIN_LABELS = {"rasengan", "chidori", "tiger", "cross", "open", "fist", "other"}


def validate_sample(doc: dict) -> list[str]:
    """Return a list of problems (empty = valid)."""
    problems: list[str] = []
    if doc.get("version") != 1:
        problems.append("version must be 1")
    if doc.get("label") not in VALID_LABELS:
        problems.append(f"bad label {doc.get('label')!r}")
    hands = doc.get("landmarks")
    if not isinstance(hands, list) or not 1 <= len(hands) <= 2:
        problems.append("landmarks must be a list of 1-2 hands")
        return problems
    for hand in hands:
        if not isinstance(hand, dict):
            problems.append("each hand needs handedness + points")
            return problems
        points = hand.get("points")
        if not isinstance(points, list) or len(points) != 21:
            problems.append("each hand needs 21 landmarks")
            return problems
        for p in points:
            if not isinstance(p, dict) or not all(k in p for k in ("x", "y", "z")):
                problems.append("landmark needs x/y/z")
                return problems
    return problems


def sample_to_training(doc: dict) -> tuple[list[float], str] | None:
    """First hand -> (normalized 63-dim, class). None when unusable for training."""
    if validate_sample(doc):
        return None
    label = str(doc["label"])
    if label in ("katon",):
        label = "tiger"
    elif label in ("bunshin",):
        label = "cross"
    elif label in ("none", "sharingan", "kurama"):
        return None
    if label not in TRAIN_LABELS:
        return None
    hands = doc["landmarks"]
    assert isinstance(hands, list)
    first = hands[0]
    assert isinstance(first, dict)
    return (normalize(first["points"]), label)


def load_dir(data_dir: Path) -> tuple[list[list[float]], list[str]]:
    """Load *.json / *.jsonl samples under data_dir into (X, y)."""
    xs: list[list[float]] = []
    ys: list[str] = []
    if not data_dir.exists():
        return xs, ys
    for path in sorted(data_dir.rglob("*")):
        if path.suffix not in (".json", ".jsonl"):
            continue
        try:
            if path.suffix == ".jsonl":
                docs = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
            else:
                content = json.loads(path.read_text(encoding="utf-8"))
                docs = content if isinstance(content, list) else [content]
        except (json.JSONDecodeError, UnicodeDecodeError):
            continue
        for doc in docs:
            if not isinstance(doc, dict):
                continue
            converted = sample_to_training(doc)
            if converted is not None:
                xs.append(converted[0])
                ys.append(converted[1])
    return xs, ys
