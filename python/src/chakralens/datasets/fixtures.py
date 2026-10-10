"""Seeded landmark fixture generator. Writes spec/fixtures/*.json.

Each fixture file holds samples with expected labels and expected features so
the web (Vitest) and Python (pytest) parity suites consume identical inputs.
Deterministic: same seed always yields the same landmarks.
"""

from __future__ import annotations

import json
from pathlib import Path

from chakralens.datasets.synth import preset
from chakralens.gestures.features import extract_hand, two_hand_features
from chakralens.gestures.rules import classify, load_spec

# (fixture_id, label, hands-spec). Hands-spec entries are (preset, seed, kwargs).
CASES: list[tuple[str, str, list[tuple[str, int, dict[str, object]]]]] = [
    ("rasengan", "rasengan", [("rasengan", 0, {}), ("rasengan", 1, {}), ("rasengan", 7, {})]),
    ("chidori", "chidori", [("chidori", 0, {}), ("chidori", 1, {}), ("chidori", 7, {})]),
    (
        "katon",
        "katon",
        [
            ("tiger", 1, {"wrist": (-40.0, 0.0)}),
            ("tiger", 2, {"wrist": (40.0, 0.0)}),
        ],
    ),
    (
        "bunshin",
        "bunshin",
        [
            ("cross", 1, {"wrist": (-70.0, 30.0), "rotate_deg": 10.0}),
            ("cross", 2, {"wrist": (70.0, 30.0), "rotate_deg": -30.0}),
        ],
    ),
    ("open_palm", "none", [("open_palm", 0, {})]),
    ("fist", "none", [("fist", 0, {})]),
    ("tiger_single", "none", [("tiger", 0, {})]),
]


def _round(obj: object, ndigits: int = 6) -> object:
    if isinstance(obj, float):
        return round(obj, ndigits)
    if isinstance(obj, dict):
        return {k: _round(v, ndigits) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_round(v, ndigits) for v in obj]
    return obj


def generate(out_dir: Path, spec_path: Path | None = None) -> list[Path]:
    """Generate fixture files. Returns written paths."""
    if spec_path is None and out_dir.name == "fixtures":
        spec_path = out_dir.parent / "gestures.json"
    spec = load_spec(spec_path)
    out_dir.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    for fixture_id, label, hands_spec in CASES:
        hands = [preset(name, seed=seed, **kwargs) for name, seed, kwargs in hands_spec]  # type: ignore[arg-type]
        predicted, confidence = classify(hands, spec)
        assert predicted == label, f"{fixture_id}: rules give {predicted}, expected {label}"
        samples = []
        for hand in hands:
            feat = extract_hand(hand)
            samples.append({"landmarks": _round(hand), "features": _round(feat.to_dict())})
        doc = {
            "version": 1,
            "id": fixture_id,
            "expectedLabel": label,
            "expectedConfidence": confidence,
            "source": "synthetic",
            "samples": samples,
        }
        if len(hands) == 2:
            doc["twoHand"] = _round(two_hand_features(hands[0], hands[1]))
        path = out_dir / f"{fixture_id}.json"
        path.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
        written.append(path)
    return written


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[4]
    paths = generate(root / "spec" / "fixtures")
    print(f"wrote {len(paths)} fixtures")
