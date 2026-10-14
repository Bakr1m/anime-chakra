# FEATURES.md: exact feature formulas (single source of truth)

Both implementations (`python/src/chakralens/gestures/features.py` and
`web/src/gestures/features.ts`) implement this document. Parity tests assert
agreement within `1e-4`. If you change the math, change it here first, then in
both languages, then regenerate fixtures.

## 0. Conventions

- A hand is 21 landmarks, MediaPipe order. Index `0` = wrist, tips
  `4/8/12/16/20`, MCPs `5/9/13/17`, PIPs `6/10/14/18`, DIPs `7/11/15/19`.
- Landmarks are normalized image coordinates: `x` right, `y` down, `z`
  roughly depth (negative toward camera). All formulas use raw input units;
  ratios cancel scale.
- `dist(a, b)` = Euclidean distance in `(x, y)` only. `dist3(a, b)` includes `z`.
- Vectors are float triples. `dot`, `norm`, `clamp(v, lo, hi)` are standard.
- `angleAt(a, b, c)` (degrees) = angle ABC at vertex `b`:
  `deg(acos(clamp(dot(a-b, c-b) / (|a-b|*|c-b|))))`. Degenerate (zero-length
  arm) yields `180.0`.
- All comparisons use `>=` / `<=` on the boundary (inclusive).

## 1. Normalization

```
handSize = dist(wrist(0), middleMCP(9))
if handSize < 1e-6: handSize = 1e-6
palmCenter = mean(mcp 5, 9, 13, 17)   # 3D mean
```

Every distance feature below is divided by `handSize`.

## 2. Per-finger features

Fingers: `thumb [1,2,3,4]`, `index [5,6,7,8]`, `middle [9,10,11,12]`,
`ring [13,14,15,16]`, `pinky [17,18,19,20]` as `(mcp, pip, dip, tip)`.

```
extension(f) = dist3(mcp, tip) / (dist3(mcp, pip) + dist3(pip, dip) + dist3(dip, tip) + 1e-6)
curlAngle(f) = angleAt(mcp, pip, tip)          # degrees; ~180 = straight
spread(f1, f2) = dist(tip1, tip2) / handSize   # adjacent pairs only
```

`extension` is ~1.0 for a straight finger, ~0.3-0.5 curled into a fist.

## 3. Hand-level features

```
openness   = mean(extension of index, middle, ring, pinky)
spreadMean = mean(spread over adjacent pairs index-middle, middle-ring, ring-pinky)
palmNormal = unit normal of triangle (wrist, indexMCP, pinkyMCP), sign-fixed:
             n = normalize(cross(indexMCP - wrist, pinkyMCP - wrist)); if n.z > 0: n = -n
             (so +z always points away from the camera-facing palm; degenerate
             triangles yield (0, 0, -1))
palmToCamera = clamp(-n.z, 0, 1)               # 1 = palm facing camera
pointing   = normalize(middleTip - wrist)      # 3D
pointingUp = clamp(-pointing.y, -1, 1)         # image y is down, so up is -y
pointingHorizontal = clamp(|pointing.x|, 0, 1)
```

## 4. Two-hand features

Inputs: hand A and hand B (order-independent; use both orderings and take the
symmetric value where noted).

```
wristDistance = dist(wristA, wristB) / mean(handSizeA, handSizeB)
fingerLine(h) = segment(indexTip, middleTip) of hand h   # 2D
crossAngle    = acute angle (degrees, 0..90) between fingerLine(A) and
                fingerLine(B): d = deg(acos(clamp(dot(u,v)))); crossAngle =
                d if d <= 90 else 180 - d. A bunshin X requires segments
                intersect (2D orientation test) AND crossAngle in
                [crossAngleMinDeg, crossAngleMaxDeg] from gestures.json.
relativeHeight = (wristA.y - wristB.y) / mean hand size (signed)
```

Segment intersection uses the standard orientation test with epsilon `1e-9`.

## 4b. Thumb-out feature (palm-vs-back discriminator)

The palm normal cannot tell palm-forward from knuckles-forward head-on (it
reads only knuckle layout). The thumb can: a cupped palm holds the thumb out
sideways, a fist folds it across the knuckles.

```
thumbOut = dist3(thumbTip(4), palmCenter) / handSize
```

Calibrated on real hands (2026-10-12): cupped palm thumbOut ~ high with
thumb extension >= 0.80; back-of-fist tucks at ~0.77 extension with narrow
tip spread. Rasengan additionally gates spread from below (cupped splays
tips, fists cluster them).

## 5. Rule inputs summary

| Symbol | Formula |
|---|---|
| `ext_index/middle/ring/pinky/thumb` | Section 2 |
| `curl_*` | Section 2 |
| `openness` | Section 3 |
| `spreadMean` | Section 2/3 |
| `palmToCamera` | Section 3 |
| `pointingUp`, `pointingHorizontal` | Section 3 |
| `wristDistance`, `crossAngle`, `linesCross` | Section 4 |

## 6. Decision thresholds

All thresholds live in `spec/gestures.json`. The rules:

- **rasengan**: `openness in [opennessMin, opennessMax]`
  AND `spreadMean in [spreadMin, spreadMax]`
  AND `ext_thumb >= thumbMin` AND `palmToCamera >= palmToCameraMin`.
- **chidori**: `min(ext_index, ext_middle, ext_ring, ext_pinky) >= fourFingersExtendedMin`
  AND `ext_thumb <= thumbTuckedMax` AND `spreadMean <= fingerSpreadMax`
  AND `pointingHorizontal >= pointingHorizontalMin`.
- **katon**: `wristDistance <= wristDistanceMax`
  AND `min(ext_index, ext_middle over both hands) >= indexMiddleExtendedMin`
  AND `max(ext_ring, ext_pinky over both hands) <= ringPinkyFoldedMax`
  AND `mean(pointingUp) >= pointingUpMin`.
- **bunshin**: `min(ext_index, ext_middle over both hands) >= bothHandsIndexMiddleExtendedMin`
  AND `linesCross` AND `crossAngle in [crossAngleMinDeg, crossAngleMaxDeg]`.

Confidence: rules output `1.0` on match, `0.0` otherwise; the MLP score and the
ensemble rule are defined in `docs/ML.md` (Phase 10). The state machine gates on
`minConfidence` from `gestures.json`.
