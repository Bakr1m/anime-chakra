// Feature extraction ported from spec/FEATURES.md. Must match
// python/src/chakralens/gestures/features.py within 1e-4 (parity-tested).

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export type Vec3 = [number, number, number];

export const EPS = 1e-6;

const FINGERS: Record<string, [number, number, number, number]> = {
  thumb: [1, 2, 3, 4],
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20],
};

export function toPoint(p: Landmark | number[]): Vec3 {
  if (Array.isArray(p)) return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0];
  return [p.x, p.y, p.z];
}

export function dist2(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function dist3(a: Vec3, b: Vec3): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(v, hi));
}

export function angleAt(a: Vec3, b: Vec3, c: Vec3): number {
  const ax = a[0] - b[0];
  const ay = a[1] - b[1];
  const az = a[2] - b[2];
  const cx = c[0] - b[0];
  const cy = c[1] - b[1];
  const cz = c[2] - b[2];
  const la = Math.sqrt(ax * ax + ay * ay + az * az);
  const lc = Math.sqrt(cx * cx + cy * cy + cz * cz);
  if (la < EPS || lc < EPS) return 180.0;
  const cosv = clamp((ax * cx + ay * cy + az * cz) / (la * lc), -1, 1);
  return (Math.acos(cosv) * 180) / Math.PI;
}

function cross(u: Vec3, v: Vec3): Vec3 {
  return [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export interface HandFeatures {
  handSize: number;
  palmCenter: Vec3;
  extension: Record<string, number>;
  curl: Record<string, number>;
  openness: number;
  spreadMean: number;
  thumbOut: number;
  palmToCamera: number;
  pointing: Vec3;
  pointingUp: number;
  pointingHorizontal: number;
}

function fingerExtension(pts: Vec3[], finger: string): number {
  const idx = FINGERS[finger];
  if (!idx) throw new Error(`unknown finger ${finger}`);
  const [mcp, pip, dip, tip] = idx;
  const straight = dist3(pts[mcp] as Vec3, pts[tip] as Vec3);
  const chain =
    dist3(pts[mcp] as Vec3, pts[pip] as Vec3) +
    dist3(pts[pip] as Vec3, pts[dip] as Vec3) +
    dist3(pts[dip] as Vec3, pts[tip] as Vec3);
  return straight / (chain + EPS);
}

function fingerCurl(pts: Vec3[], finger: string): number {
  const idx = FINGERS[finger];
  if (!idx) throw new Error(`unknown finger ${finger}`);
  const [mcp, pip, , tip] = idx;
  return angleAt(pts[mcp] as Vec3, pts[pip] as Vec3, pts[tip] as Vec3);
}

export function extractHand(landmarks: Landmark[]): HandFeatures {
  if (landmarks.length !== 21) throw new Error(`expected 21 landmarks, got ${landmarks.length}`);
  const pts = landmarks.map((p) => toPoint(p));
  const wrist = pts[0] as Vec3;
  const handSize = Math.max(dist2(wrist, pts[9] as Vec3), EPS);
  const mcp = [5, 9, 13, 17].map((i) => pts[i] as Vec3);
  const palmCenter: Vec3 = [
    (mcp[0]![0] + mcp[1]![0] + mcp[2]![0] + mcp[3]![0]) / 4,
    (mcp[0]![1] + mcp[1]![1] + mcp[2]![1] + mcp[3]![1]) / 4,
    (mcp[0]![2] + mcp[1]![2] + mcp[2]![2] + mcp[3]![2]) / 4,
  ];
  const extension: Record<string, number> = {};
  const curl: Record<string, number> = {};
  for (const f of Object.keys(FINGERS)) {
    extension[f] = fingerExtension(pts, f);
    curl[f] = fingerCurl(pts, f);
  }
  const openness =
    ((extension['index'] ?? 0) +
      (extension['middle'] ?? 0) +
      (extension['ring'] ?? 0) +
      (extension['pinky'] ?? 0)) /
    4;
  const spreads = [
    dist2(pts[8] as Vec3, pts[12] as Vec3) / handSize,
    dist2(pts[12] as Vec3, pts[16] as Vec3) / handSize,
    dist2(pts[16] as Vec3, pts[20] as Vec3) / handSize,
  ];
  const spreadMean = (spreads[0]! + spreads[1]! + spreads[2]!) / 3;
  const thumbTip = pts[4] as Vec3;
  const thumbOut = dist3(thumbTip, palmCenter) / handSize;
  let n = cross(sub(pts[5] as Vec3, wrist), sub(pts[17] as Vec3, wrist));
  const ln = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);
  n = ln < EPS ? [0, 0, -1] : [n[0] / ln, n[1] / ln, n[2] / ln];
  if (n[2] > 0) n = [-n[0], -n[1], -n[2]];
  const palmToCamera = clamp(-n[2], 0, 1);
  const w = sub(pts[12] as Vec3, wrist);
  const lw = Math.sqrt(w[0] * w[0] + w[1] * w[1] + w[2] * w[2]);
  const pointing: Vec3 = lw < EPS ? [0, 0, 0] : [w[0] / lw, w[1] / lw, w[2] / lw];
  return {
    handSize,
    palmCenter,
    extension,
    curl,
    openness,
    spreadMean,
    thumbOut,
    palmToCamera,
    pointing,
    pointingUp: clamp(-pointing[1], -1, 1),
    pointingHorizontal: clamp(Math.abs(pointing[0]), 0, 1),
  };
}

function orient(a: Vec3, b: Vec3, c: Vec3): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

export function segmentsIntersect(p1: Vec3, p2: Vec3, p3: Vec3, p4: Vec3): boolean {
  const e = 1e-9;
  const d1 = orient(p3, p4, p1);
  const d2 = orient(p3, p4, p2);
  const d3 = orient(p1, p2, p3);
  const d4 = orient(p1, p2, p4);
  const opposing1 = (d1 > e && d2 < -e) || (d1 < -e && d2 > e);
  const opposing2 = (d3 > e && d4 < -e) || (d3 < -e && d4 > e);
  return Boolean(opposing1 && opposing2);
}

export interface TwoHandFeatures {
  wristDistance: number;
  crossAngle: number;
  linesCross: boolean;
  relativeHeight: number;
}

export function twoHandFeatures(a: Landmark[], b: Landmark[]): TwoHandFeatures {
  const pa = a.map((p) => toPoint(p));
  const pb = b.map((p) => toPoint(p));
  const fa = extractHand(a);
  const fb = extractHand(b);
  const meanSize = (fa.handSize + fb.handSize) / 2;
  const wristDistance = dist2(pa[0] as Vec3, pb[0] as Vec3) / meanSize;
  const ua = [(pa[12] as Vec3)[0] - (pa[8] as Vec3)[0], (pa[12] as Vec3)[1] - (pa[8] as Vec3)[1]];
  const ub = [(pb[12] as Vec3)[0] - (pb[8] as Vec3)[0], (pb[12] as Vec3)[1] - (pb[8] as Vec3)[1]];
  const la = Math.hypot(ua[0] as number, ua[1] as number);
  const lb = Math.hypot(ub[0] as number, ub[1] as number);
  let crossAngle = 0;
  if (la >= EPS && lb >= EPS) {
    const cosv = clamp(((ua[0] as number) * (ub[0] as number) + (ua[1] as number) * (ub[1] as number)) / (la * lb), -1, 1);
    const d = (Math.acos(cosv) * 180) / Math.PI;
    crossAngle = d <= 90 ? d : 180 - d;
  }
  return {
    wristDistance,
    crossAngle,
    linesCross: segmentsIntersect(pa[8] as Vec3, pa[12] as Vec3, pb[8] as Vec3, pb[12] as Vec3),
    relativeHeight: ((pa[0] as Vec3)[1] - (pb[0] as Vec3)[1]) / meanSize,
  };
}
