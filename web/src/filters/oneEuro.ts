// One Euro filter for smoothing landmark streams (adaptive to speed).
// G. Casiez et al., "1 Euro Filter: A Simple Speed-based Low-pass Filter
// for Noisy Input in Interaction", CHI 2012.

export interface OneEuroOptions {
  freq: number;
  minCutoff: number;
  beta: number;
  dcutoff: number;
}

export const DEFAULT_ONE_EURO: OneEuroOptions = { freq: 30, minCutoff: 1.0, beta: 0.02, dcutoff: 1.0 };

function alpha(freq: number, cutoff: number): number {
  const te = 1 / freq;
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / te);
}

export class LowPassFilter {
  private y: number | null = null;
  private a = 0;

  setAlpha(a: number): void {
    this.a = a;
  }

  filter(x: number): number {
    this.y = this.y === null ? x : this.a * x + (1 - this.a) * this.y;
    return this.y;
  }

  last(): number {
    return this.y ?? 0;
  }
}

export class OneEuroFilter {
  private x = new LowPassFilter();
  private dx = new LowPassFilter();
  private lastT = -1;
  constructor(private opts: OneEuroOptions = DEFAULT_ONE_EURO) {}

  filter(value: number, t?: number): number {
    const now = t ?? performance.now() / 1000;
    const freq = this.lastT < 0 ? this.opts.freq : 1 / Math.max(now - this.lastT, 1e-6);
    this.lastT = now;
    const d = this.x.last() === 0 && this.dx.last() === 0 ? 0 : value - this.x.last();
    this.dx.setAlpha(alpha(freq, this.opts.dcutoff));
    const dxHat = this.dx.filter(Number.isFinite(d) ? d : 0);
    const cutoff = this.opts.minCutoff + this.opts.beta * Math.abs(dxHat);
    this.x.setAlpha(alpha(freq, cutoff));
    return this.x.filter(value);
  }
}

/** Smooths a full 21-landmark hand (x, y, z independently). */
export class LandmarkSmoother {
  private filters: OneEuroFilter[] = [];
  constructor(nLandmarks = 21, opts: OneEuroOptions = DEFAULT_ONE_EURO) {
    for (let i = 0; i < nLandmarks * 3; i++) this.filters.push(new OneEuroFilter(opts));
  }

  reset(): void {
    const opts = DEFAULT_ONE_EURO;
    this.filters = this.filters.map(() => new OneEuroFilter(opts));
  }

  smooth(pts: { x: number; y: number; z: number }[], t?: number): { x: number; y: number; z: number }[] {
    return pts.map((p, i) => ({
      x: (this.filters[i * 3] as OneEuroFilter).filter(p.x, t),
      y: (this.filters[i * 3 + 1] as OneEuroFilter).filter(p.y, t),
      z: (this.filters[i * 3 + 2] as OneEuroFilter).filter(p.z, t),
    }));
  }
}
