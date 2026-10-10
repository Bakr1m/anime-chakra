// Seeded recursive midpoint-displacement lightning. Same seed + endpoints
// always produce the same bolts (deterministic flicker, testable).
export interface BoltPoint {
  x: number;
  y: number;
}

export function buildBolt(
  from: BoltPoint,
  to: BoltPoint,
  rand: () => number,
  levels = 4,
  jitter = 0.28,
  branches = true,
): BoltPoint[][] {
  const pts: BoltPoint[] = [from, to];
  for (let l = 0; l < levels; l++) {
    const out: BoltPoint[] = [pts[0] as BoltPoint];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1] as BoltPoint;
      const b = pts[i] as BoltPoint;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const off = (rand() - 0.5) * 2 * len * jitter;
      // displace perpendicular
      const nx = -(b.y - a.y) / (len || 1);
      const ny = (b.x - a.x) / (len || 1);
      out.push({ x: mx + nx * off, y: my + ny * off }, b);
    }
    pts.splice(0, pts.length, ...out);
  }
  const bolts = [pts];
  if (branches) {
    // side branches from interior points
    const nBranch = 1 + Math.floor(rand() * 2);
    for (let b = 0; b < nBranch; b++) {
      const at = pts[Math.floor(rand() * (pts.length - 2)) + 1] as BoltPoint;
      const ang = rand() * Math.PI * 2;
      const len = Math.hypot(to.x - from.x, to.y - from.y) * (0.2 + rand() * 0.25);
      const tip = { x: at.x + Math.cos(ang) * len, y: at.y + Math.sin(ang) * len };
      bolts.push(midpointLine(at, tip, rand, 2, jitter));
    }
  }
  return bolts;
}

function midpointLine(from: BoltPoint, to: BoltPoint, rand: () => number, levels: number, jitter: number): BoltPoint[] {
  let pts = [from, to];
  for (let l = 0; l < levels; l++) {
    const out: BoltPoint[] = [pts[0] as BoltPoint];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1] as BoltPoint;
      const b = pts[i] as BoltPoint;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const off = (rand() - 0.5) * 2 * len * jitter;
      const nx = -(b.y - a.y) / (len || 1);
      const ny = (b.x - a.x) / (len || 1);
      out.push({ x: (a.x + b.x) / 2 + nx * off, y: (a.y + b.y) / 2 + ny * off }, b);
    }
    pts = out;
  }
  return pts;
}
