// FPS meter, adaptive quality, and copyable device reports.
export type QualityLevel = 0 | 1 | 2;

export interface DeviceReport {
  userAgent: string;
  viewport: [number, number];
  video: [number, number];
  delegate: string;
  devicePixelRatio: number;
  avgMs: number;
  p95Ms: number;
  quality: QualityLevel;
}

export class QualityManager {
  level: QualityLevel = 0;
  delegate = 'unknown';
  reducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private samples: number[] = [];
  private lowSince = -1;
  fps = 60;

  /** particle budget multiplier per level (reduced motion pins it low) */
  get particleScale(): number {
    if (this.reducedMotion) return 0.25;
    return this.level === 0 ? 1 : this.level === 1 ? 0.5 : 0.25;
  }

  get pixelRatio(): number {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
    const cap = Math.min(dpr, 2);
    return this.level === 0 ? cap : this.level === 1 ? Math.min(cap, 1.5) : 1;
  }

  get bloomEnabled(): boolean {
    return this.level < 2;
  }

  update(dtMs: number, nowMs: number): void {
    this.fps += 1000 / Math.max(dtMs, 1e-3) / 60 - this.fps * 0.02;
    this.samples.push(dtMs);
    if (this.samples.length > 240) this.samples.shift();
    const fps = 1000 / Math.max(dtMs, 1e-3);
    if (fps < 24 && this.level < 2) {
      if (this.lowSince < 0) this.lowSince = nowMs;
      if (nowMs - this.lowSince > 2000) {
        this.level = (this.level + 1) as QualityLevel;
        this.lowSince = -1;
      }
    } else {
      this.lowSince = -1;
    }
  }

  report(video: [number, number]): DeviceReport {
    const sorted = [...this.samples].sort((a, b) => a - b);
    const avg = sorted.length ? sorted.reduce((s, v) => s + v, 0) / sorted.length : 0;
    const p95 = sorted.length ? (sorted[Math.floor(sorted.length * 0.95)] ?? 0) : 0;
    const nav = typeof navigator !== 'undefined' ? navigator.userAgent : 'node';
    const win = typeof window !== 'undefined' ? window : null;
    return {
      userAgent: nav,
      viewport: win ? [win.innerWidth, win.innerHeight] : [0, 0],
      video,
      delegate: this.delegate,
      devicePixelRatio: win ? win.devicePixelRatio : 1,
      avgMs: Math.round(avg * 100) / 100,
      p95Ms: Math.round(p95 * 100) / 100,
      quality: this.level,
    };
  }

  async copyReport(video: [number, number]): Promise<string> {
    const text = JSON.stringify(this.report(video), null, 2);
    await navigator.clipboard.writeText(text);
    return text;
  }
}
