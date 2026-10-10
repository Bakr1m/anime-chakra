"""Synth generator ranges + augmentation sanity."""

from chakralens.datasets.synth import CLASSES, augment, generate_dataset, normalize, preset


def test_normalize_centers_and_scales() -> None:
    vec = normalize(preset("open_palm", seed=0))
    assert len(vec) == 63
    assert vec[0] == 0.0 and vec[1] == 0.0 and vec[2] == 0.0
    # middle MCP (index 9) x/y scaled by hand size
    import math

    hand = preset("open_palm", seed=0)
    size = math.hypot(hand[9]["x"] - hand[0]["x"], hand[9]["y"] - hand[0]["y"])
    assert abs(vec[27] - (hand[9]["x"] - hand[0]["x"]) / size) < 1e-9


def test_dataset_shape_and_classes() -> None:
    xs, ys = generate_dataset(n_per_class=10, seed=3)
    assert len(xs) == 10 * len(CLASSES) == len(ys)
    assert set(ys) == set(CLASSES)
    xs2, ys2 = generate_dataset(n_per_class=10, seed=3)
    assert xs == xs2 and ys == ys2


def test_augment_keeps_landmark_count() -> None:
    import random

    hand = preset("rasengan", seed=0)
    out = augment(hand, random.Random(0))
    assert len(out) == 21
    assert out != hand
