"""Rule classifier for the four core signs. Thresholds come from spec/gestures.json."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .features import HandFeatures, extract_hand, two_hand_features

LABEL_NONE = "none"


def load_spec(path: str | Path | None = None) -> dict[str, Any]:
    if path is None:
        path = Path(__file__).resolve().parents[4] / "spec" / "gestures.json"
    with open(path, encoding="utf-8") as f:
        return json.load(f)  # type: ignore[no-any-return]


def _rules_for(spec: dict[str, Any], jutsu_id: str) -> dict[str, Any]:
    for j in spec["jutsu"]:
        if j["id"] == jutsu_id:
            return dict[str, Any](j["rules"])
    raise KeyError(jutsu_id)


def match_rasengan(feat: HandFeatures, rules: dict[str, Any]) -> bool:
    return (
        float(rules["opennessMin"]) <= feat.openness <= float(rules["opennessMax"])
        and float(rules["spreadMin"]) <= feat.spread_mean <= float(rules["spreadMax"])
        and feat.extension["thumb"] >= float(rules["thumbMin"])
        and feat.palm_to_camera >= float(rules["palmToCameraMin"])
    )


def match_chidori(feat: HandFeatures, rules: dict[str, Any]) -> bool:
    four = min(
        feat.extension["index"],
        feat.extension["middle"],
        feat.extension["ring"],
        feat.extension["pinky"],
    )
    return (
        four >= float(rules["fourFingersExtendedMin"])
        and feat.extension["thumb"] <= float(rules["thumbTuckedMax"])
        and feat.spread_mean <= float(rules["fingerSpreadMax"])
        and feat.pointing_horizontal >= float(rules["pointingHorizontalMin"])
    )


def match_katon(a: HandFeatures, b: HandFeatures, two: dict[str, Any], rules: dict[str, Any]) -> bool:
    idx_mid = min(
        a.extension["index"], a.extension["middle"], b.extension["index"], b.extension["middle"]
    )
    folded = max(a.extension["ring"], a.extension["pinky"], b.extension["ring"], b.extension["pinky"])
    pointing = (a.pointing_up + b.pointing_up) / 2.0
    return (
        float(two["wristDistance"]) <= float(rules["wristDistanceMax"])
        and idx_mid >= float(rules["indexMiddleExtendedMin"])
        and folded <= float(rules["ringPinkyFoldedMax"])
        and pointing >= float(rules["pointingUpMin"])
    )


def match_bunshin(a: HandFeatures, b: HandFeatures, two: dict[str, Any], rules: dict[str, Any]) -> bool:
    ext = min(
        a.extension["index"], a.extension["middle"], b.extension["index"], b.extension["middle"]
    )
    angle = float(two["crossAngle"])
    return (
        ext >= float(rules["bothHandsIndexMiddleExtendedMin"])
        and bool(two["linesCross"])
        and float(rules["crossAngleMinDeg"]) <= angle <= float(rules["crossAngleMaxDeg"])
    )


def classify(hands: list[list[dict[str, Any]]], spec: dict[str, Any] | None = None) -> tuple[str, float]:
    """Classify 1-2 hands. Returns (label, confidence). Two-hand jutsus outrank one-hand."""
    spec = spec or load_spec()
    feats = [extract_hand(h) for h in hands]
    if len(feats) == 2:
        two = two_hand_features(hands[0], hands[1])
        if match_bunshin(feats[0], feats[1], two, _rules_for(spec, "bunshin")):
            return ("bunshin", 1.0)
        if match_katon(feats[0], feats[1], two, _rules_for(spec, "katon")):
            return ("katon", 1.0)
    if len(feats) >= 1:
        f = feats[0]
        if match_rasengan(f, _rules_for(spec, "rasengan")):
            return ("rasengan", 1.0)
        if match_chidori(f, _rules_for(spec, "chidori")):
            return ("chidori", 1.0)
    return (LABEL_NONE, 0.0)
