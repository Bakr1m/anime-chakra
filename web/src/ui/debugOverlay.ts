// ?debug=1 skeleton overlay: draws hand landmarks + active jutsu + fps.
import type { Landmark } from '../gestures/features';

export class DebugOverlay {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private pre: HTMLPreElement | null = null;
  enabled = new URLSearchParams(location.search).has('debug');

  constructor(parent: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'debug-overlay';
    parent.appendChild(this.canvas);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    this.ctx = ctx;
    if (this.enabled) {
      // canvas fillText is not selectable; a DOM block makes the gate line
      // copyable on desktop and mobile (long-press select / copy button).
      const block = document.createElement('div');
      block.className = 'debug-block';
      const pre = document.createElement('pre');
      pre.className = 'debug-block-text';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'debug-copy';
      btn.textContent = 'Copy debug';
      btn.addEventListener('click', () => {
        const text = pre.textContent ?? '';
        navigator.clipboard
          ?.writeText(text)
          .then(() => {
            btn.textContent = 'Copied!';
            setTimeout(() => {
              btn.textContent = 'Copy debug';
            }, 1500);
          })
          .catch(() => undefined);
      });
      block.append(pre, btn);
      parent.appendChild(block);
      this.pre = pre;
    }
  }

  resize(w: number, h: number): void {
    this.canvas.width = w;
    this.canvas.height = h;
  }

  /** plain-text telemetry for the selectable DOM block */
  setText(text: string): void {
    if (this.pre) this.pre.textContent = text;
  }

  draw(
    hands: Landmark[][],
    label: string,
    charge: number,
    fps: number,
    extra = '',
    extra2 = '',
  ): void {
    if (!this.enabled) return;
    const { ctx } = this;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0f0';
    ctx.font = '14px monospace';
    ctx.fillText(`${label} charge=${charge.toFixed(2)} fps=${fps.toFixed(0)}`, 8, 18);
    if (extra) ctx.fillText(extra, 8, 36);
    if (extra2) ctx.fillText(extra2, 8, 54);
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
