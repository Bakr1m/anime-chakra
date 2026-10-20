// Rule classifier. Thresholds come from spec/gestures.json via spec.ts.
// Every matcher is the conjunction of named gates: the *Gates functions
// return '' when all pass, or the first failing gate as `key=measured/bound`
// so the ?debug overlay can show exactly which threshold rejects a sign.
import { extractHand, twoHandFeatures, type HandFeatures, type Landmark, type TwoHandFeatures } from './features';
import { getSpec, rulesFor, type GestureSpec, type JutsuRules } from './spec';

export const LABEL_NONE = 'none';

const r2 = (v: number): string => v.toFixed(2);
const r0 = (v: number): string => v.toFixed(0);

export function rasenganGates(feat: HandFeatures, rules: JutsuRules): string {
  const oLo = rules['opennessMin'] as number;
  const oHi = rules['opennessMax'] as number;
  const sLo = rules['spreadMin'] as number;
  const sHi = rules['spreadMax'] as number;
  const th = rules['thumbMin'] as number;
  const pa = rules['palmToCameraMin'] as number;
  const thumb = feat.extension['thumb'] ?? 0;
  if (feat.openness < oLo) return `opL=${r2(feat.openness)}/${r2(oLo)}`;
  if (feat.openness > oHi) return `opH=${r2(feat.openness)}/${r2(oHi)}`;
  if (feat.spreadMean < sLo) return `spL=${r2(feat.spreadMean)}/${r2(sLo)}`;
  if (feat.spreadMean > sHi) return `spH=${r2(feat.spreadMean)}/${r2(sHi)}`;
  if (thumb < th) return `th=${r2(thumb)}/${r2(th)}`;
  if (feat.palmToCamera < pa) return `pa=${r2(feat.palmToCamera)}/${r2(pa)}`;
  return '';
}

export function matchRasengan(feat: HandFeatures, rules: JutsuRules): boolean {
  return rasenganGates(feat, rules) === '';
}

function chidoriFour(feat: HandFeatures): number {
  return Math.min(
    feat.extension['index'] ?? 0,
    feat.extension['middle'] ?? 0,
    feat.extension['ring'] ?? 0,
    feat.extension['pinky'] ?? 0,
  );
}

export function chidoriGates(feat: HandFeatures, rules: JutsuRules): string {
  const fo = rules['fourFingersExtendedMin'] as number;
  const th = rules['thumbTuckedMax'] as number;
  const sp = rules['fingerSpreadMax'] as number;
  const ho = rules['pointingHorizontalMin'] as number;
  const four = chidoriFour(feat);
  const thumb = feat.extension['thumb'] ?? 1;
  if (four < fo) return `fo=${r2(four)}/${r2(fo)}`;
  if (thumb > th) return `th=${r2(thumb)}/${r2(th)}`;
  if (feat.spreadMean > sp) return `sp=${r2(feat.spreadMean)}/${r2(sp)}`;
  if (feat.pointingHorizontal < ho) return `ho=${r2(feat.pointingHorizontal)}/${r2(ho)}`;
  return '';
}

export function matchChidori(feat: HandFeatures, rules: JutsuRules): boolean {
  return chidoriGates(feat, rules) === '';
}

function katonIdxMid(a: HandFeatures, b: HandFeatures): number {
  return Math.min(
    a.extension['index'] ?? 0,
    a.extension['middle'] ?? 0,
    b.extension['index'] ?? 0,
    b.extension['middle'] ?? 0,
  );
}

function katonFolded(a: HandFeatures, b: HandFeatures): number {
  return Math.max(
    a.extension['ring'] ?? 1,
    a.extension['pinky'] ?? 1,
    b.extension['ring'] ?? 1,
    b.extension['pinky'] ?? 1,
  );
}

export function katonGates(a: HandFeatures, b: HandFeatures, two: TwoHandFeatures, rules: JutsuRules): string {
  const wd = rules['wristDistanceMax'] as number;
  const im = rules['indexMiddleExtendedMin'] as number;
  const fo = rules['ringPinkyFoldedMax'] as number;
  const up = rules['pointingUpMin'] as number;
  const pointing = (a.pointingUp + b.pointingUp) / 2;
  if (two.wristDistance > wd) return `wd=${r2(two.wristDistance)}/${r2(wd)}`;
  if (katonIdxMid(a, b) < im) return `im=${r2(katonIdxMid(a, b))}/${r2(im)}`;
  if (katonFolded(a, b) > fo) return `fo=${r2(katonFolded(a, b))}/${r2(fo)}`;
  if (pointing < up) return `up=${r2(pointing)}/${r2(up)}`;
  return '';
}

export function matchKaton(a: HandFeatures, b: HandFeatures, two: TwoHandFeatures, rules: JutsuRules): boolean {
  return katonGates(a, b, two, rules) === '';
}

function bunshinExt(a: HandFeatures, b: HandFeatures): number {
  return Math.min(
    a.extension['index'] ?? 0,
    a.extension['middle'] ?? 0,
    b.extension['index'] ?? 0,
    b.extension['middle'] ?? 0,
  );
}

export function bunshinGates(a: HandFeatures, b: HandFeatures, two: TwoHandFeatures, rules: JutsuRules): string {
  const ex = rules['bothHandsIndexMiddleExtendedMin'] as number;
  const anLo = rules['crossAngleMinDeg'] as number;
  const anHi = rules['crossAngleMaxDeg'] as number;
  const ext = bunshinExt(a, b);
  if (ext < ex) return `ex=${r2(ext)}/${r2(ex)}`;
  if (!two.linesCross) return 'ln=0/1';
  if (two.crossAngle < anLo) return `anL=${r0(two.crossAngle)}/${r0(anLo)}`;
  if (two.crossAngle > anHi) return `anH=${r0(two.crossAngle)}/${r0(anHi)}`;
  return '';
}

export function matchBunshin(a: HandFeatures, b: HandFeatures, two: TwoHandFeatures, rules: JutsuRules): boolean {
  return bunshinGates(a, b, two, rules) === '';
}

/** Worst tip→MCP distance over both hands, palm-size normalized. */
function fistRatio(h: Landmark[]): number {
  const w = h[0];
  const m = h[9];
  if (!w || !m) return Infinity;
  const size = Math.hypot(m.x - w.x, m.y - w.y) || 1e-6;
  let worst = 0;
  const pairs: [number, number][] = [
    [5, 8],
    [9, 12],
    [13, 16],
    [17, 20],
  ];
  for (const [mcp, tip] of pairs) {
    const a = h[mcp];
    const b = h[tip];
    if (!a || !b) return Infinity;
    worst = Math.max(worst, Math.hypot(b.x - a.x, b.y - a.y) / size);
  }
  return worst;
}

export function kuramaGates(hands: Landmark[][], rules: JutsuRules): string {
  if (hands.length < 2 || !hands[0] || !hands[1]) return 'h2';
  const fi = rules['fistRatioMax'] as number;
  const wy = rules['wristYMax'] as number;
  const ratio = Math.max(fistRatio(hands[0]), fistRatio(hands[1]));
  const y = Math.max(hands[0][0]?.y ?? 1, hands[1][0]?.y ?? 1);
  if (ratio > fi) return `fi=${r2(ratio)}/${r2(fi)}`;
  if (y > wy) return `y=${r2(y)}/${r2(wy)}`;
  return '';
}

export function matchKurama(hands: Landmark[][], rules: JutsuRules): boolean {
  return kuramaGates(hands, rules) === '';
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
  // one-hand signs: check EVERY detected hand — MediaPipe's order is not
  // guaranteed, so the signing hand may be at index 1.
  for (const f of feats) {
    if (matchRasengan(f, rulesFor(s, 'rasengan'))) return ['rasengan', 1.0];
    if (matchChidori(f, rulesFor(s, 'chidori'))) return ['chidori', 1.0];
  }
  return [LABEL_NONE, 0.0];
}

const SHORT: Record<string, string> = {
  rasengan: 'ras',
  chidori: 'chid',
  katon: 'kat',
  bunshin: 'bun',
  kurama: 'kur',
};

/** First failing gate per sign for the ?debug overlay, e.g.
 *  `ras:ok chid:th=0.78/0.75 kat:h2 bun:ln=0/1 kur:y=0.58/0.50`. */
export function gateReport(hands: Landmark[][], spec?: GestureSpec): string {
  const s = spec ?? getSpec();
  const feats = hands.map((h) => extractHand(h));
  const parts: string[] = [];
  const oneHand = (id: string, gates: (f: HandFeatures, r: JutsuRules) => string): void => {
    const r = rulesFor(s, id);
    const short = SHORT[id] ?? id.slice(0, 3);
    if (feats.length === 0) {
      parts.push(`${short}:h1`);
      return;
    }
    for (const f of feats) {
      if (gates(f, r) === '') {
        parts.push(`${short}:ok`);
        return;
      }
    }
    parts.push(`${short}:${gates(feats[0] as HandFeatures, r)}`);
  };
  oneHand('rasengan', rasenganGates);
  oneHand('chidori', chidoriGates);
  const two =
    hands.length === 2 && hands[0] && hands[1] ? twoHandFeatures(hands[0], hands[1]) : null;
  const twoHand = (
    id: string,
    gates: (a: HandFeatures, b: HandFeatures, t: TwoHandFeatures, r: JutsuRules) => string,
  ): void => {
    const short = SHORT[id] ?? id.slice(0, 3);
    if (!two || !feats[0] || !feats[1]) {
      parts.push(`${short}:h2`);
      return;
    }
    const fail = gates(feats[0], feats[1], two, rulesFor(s, id));
    parts.push(`${short}:${fail === '' ? 'ok' : fail}`);
  };
  twoHand('katon', katonGates);
  twoHand('bunshin', bunshinGates);
  const kur = kuramaGates(hands, rulesFor(s, 'kurama'));
  parts.push(`kur:${kur === '' ? 'ok' : kur}`);
  return parts.join(' ');
}
