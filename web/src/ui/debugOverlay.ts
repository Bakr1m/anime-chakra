// ?debug=1 skeleton overlay: draws hand landmarks + active jutsu + fps.
import type { Landmark } from '../gestures/features';

export class DebugOverlay {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  enabled = new URLSearchParams(location.search).has('debug');

  constructor(parent: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'debug-overlay';
    parent.appendChild(this.canvas);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    this.ctx = ctx;
  }

  resize(w: number, h: number): void {
    this.canvas.width = w;
    this.canvas.height = h;
  }

  draw(hands: Landmark[][], label: string, charge: number, fps: number): void {
    if (!this.enabled) return;
    const { ctx } = this;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0f0';
    ctx.font = '14px monospace';
    ctx.fillText(`${label} charge=${charge.toFixed(2)} fps=${fps.toFixed(0)}`, 8, 18);
    ctx.strokeStyle = '#0f0';
    for (const hand of hands) {
      ctx.beginPath();
      for (const p of hand) {
        ctx.fillStyle = '#0f0';
        ctx.fillRect(p.x * W - 1, p.y * H - 1, 3, 3);
      }
      ctx.stroke();
    }
  }
}
