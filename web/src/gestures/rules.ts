// Rule classifier. Thresholds come from spec/gestures.json via spec.ts.
import { extractHand, twoHandFeatures, type HandFeatures, type Landmark, type TwoHandFeatures } from './features';
import { getSpec, rulesFor, type GestureSpec, type JutsuRules } from './spec';

export const LABEL_NONE = 'none';

export function matchRasengan(feat: HandFeatures, rules: JutsuRules): boolean {
  return (
    (rules['opennessMin'] as number) <= feat.openness &&
    feat.openness <= (rules['opennessMax'] as number) &&
    (rules['spreadMin'] as number) <= feat.spreadMean &&
    feat.spreadMean <= (rules['spreadMax'] as number) &&
    (feat.extension['thumb'] ?? 0) >= (rules['thumbMin'] as number) &&
    feat.palmToCamera >= (rules['palmToCameraMin'] as number)
  );
}

export function matchChidori(feat: HandFeatures, rules: JutsuRules): boolean {
  const four = Math.min(
    feat.extension['index'] ?? 0,
    feat.extension['middle'] ?? 0,
    feat.extension['ring'] ?? 0,
    feat.extension['pinky'] ?? 0,
  );
  return (
    four >= (rules['fourFingersExtendedMin'] as number) &&
    (feat.extension['thumb'] ?? 1) <= (rules['thumbTuckedMax'] as number) &&
    feat.spreadMean <= (rules['fingerSpreadMax'] as number) &&
    feat.pointingHorizontal >= (rules['pointingHorizontalMin'] as number)
  );
}

export function matchKaton(a: HandFeatures, b: HandFeatures, two: TwoHandFeatures, rules: JutsuRules): boolean {
  const idxMid = Math.min(
    a.extension['index'] ?? 0,
    a.extension['middle'] ?? 0,
    b.extension['index'] ?? 0,
    b.extension['middle'] ?? 0,
  );
  const folded = Math.max(
    a.extension['ring'] ?? 1,
    a.extension['pinky'] ?? 1,
    b.extension['ring'] ?? 1,
    b.extension['pinky'] ?? 1,
  );
  const pointing = (a.pointingUp + b.pointingUp) / 2;
  return (
    two.wristDistance <= (rules['wristDistanceMax'] as number) &&
    idxMid >= (rules['indexMiddleExtendedMin'] as number) &&
    folded <= (rules['ringPinkyFoldedMax'] as number) &&
    pointing >= (rules['pointingUpMin'] as number)
  );
}

export function matchBunshin(a: HandFeatures, b: HandFeatures, two: TwoHandFeatures, rules: JutsuRules): boolean {
  const ext = Math.min(
    a.extension['index'] ?? 0,
    a.extension['middle'] ?? 0,
    b.extension['index'] ?? 0,
    b.extension['middle'] ?? 0,
  );
  return (
    ext >= (rules['bothHandsIndexMiddleExtendedMin'] as number) &&
    two.linesCross &&
    (rules['crossAngleMinDeg'] as number) <= two.crossAngle &&
    two.crossAngle <= (rules['crossAngleMaxDeg'] as number)
  );
}

export function classify(hands: Landmark[][], spec?: GestureSpec): [string, number] {
  const s = spec ?? getSpec();
  const feats = hands.map((h) => extractHand(h));
  if (feats.length === 2 && hands.length === 2) {
    const two = twoHandFeatures(hands[0] as Landmark[], hands[1] as Landmark[]);
    if (matchBunshin(feats[0] as HandFeatures, feats[1] as HandFeatures, two, rulesFor(s, 'bunshin'))) {
      return ['bunshin', 1.0];
    }
    if (matchKaton(feats[0] as HandFeatures, feats[1] as HandFeatures, two, rulesFor(s, 'katon'))) {
      return ['katon', 1.0];
    }
  }
  if (feats.length >= 1) {
    const f = feats[0] as HandFeatures;
    if (matchRasengan(f, rulesFor(s, 'rasengan'))) return ['rasengan', 1.0];
    if (matchChidori(f, rulesFor(s, 'chidori'))) return ['chidori', 1.0];
  }
  return [LABEL_NONE, 0.0];
}
