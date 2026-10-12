// JutsuManager: owns jutsu instances, routes anchors, lazily starts the
// segmentation/face pipelines only when the active jutsu needs them.
import type { Landmark } from '../gestures/features';
import * as THREE from 'three';
import type { OverlayRenderer } from '../render/renderer';
import type { ParticlePool } from '../render/particles';
import type { QualityManager } from '../render/quality';
import type { SynthAudio } from '../audio/voices';
import { mulberry32, hashSeed } from '../render/clock';
import { FaceTracker } from '../vision/face';
import { Segmentation } from '../vision/segmentation';
import { Rasengan } from './rasengan/rasengan';
import { Chidori } from './chidori/chidori';
import { KageBunshin } from './bunshin/bunshin';
import { Katon } from './katon/katon';
import { Sharingan } from './sharingan/sharingan';
import { KuramaCloak } from './kurama/kurama';
import { JutsuState } from '../gestures/stateMachine';
import { getSpec } from '../gestures/spec';
import type { EffectAnchor, Jutsu, JutsuContext } from './types';

export interface FrameInput {
  dt: number;
  time: number;
  hands: Landmark[][];
  video: HTMLVideoElement | null;
  label: string;
  charge: number;
  activeId: string | null;
  demoMouth?: { x: number; y: number; headPx: number } | null;
  /** demo/forced jutsu bypasses the classifier (stretch modes) */
  forceId?: string | null;
  demoEye?: { x: number; y: number; size: number } | null;
  demoMask?: THREE.Texture | null;
}

export class JutsuManager implements JutsuContext {
  renderer: OverlayRenderer;
  particles: ParticlePool;
  quality: QualityManager;
  audio: SynthAudio;
  rng: () => number = Math.random;
  time = 0;
  /** front-camera selfie preview is mirrored; face coords flip to match hands */
  mirrored = false;

  /** mirror a normalized camera-space x into the (possibly mirrored) view */
  private fx(u: number): number {
    return this.mirrored ? 1 - u : u;
  }
  seg = new Segmentation();
  face = new FaceTracker();
  private jutsu: Record<string, Jutsu> = {};
  private current: Jutsu | null = null;
  private holdTime = 0;
  private pipelinesFor: string | null = null;

  constructor(
    renderer: OverlayRenderer,
    particles: ParticlePool,
    quality: QualityManager,
    audio: SynthAudio,
    seed?: number,
  ) {
    this.renderer = renderer;
    this.particles = particles;
    this.quality = quality;
    this.audio = audio;
    if (seed !== undefined) this.rng = mulberry32(seed);
    const rasengan = new Rasengan();
    const chidori = new Chidori();
    const bunshin = new KageBunshin();
    const katon = new Katon();
    const sharingan = new Sharingan();
    const kurama = new KuramaCloak();
    this.jutsu = { rasengan, chidori, bunshin, katon, sharingan, kurama };
    this.spec = getSpec();
  }

  private spec: ReturnType<typeof getSpec>;
  private sharinganStreak = new JutsuState();
  private kuramaStreak = new JutsuState();

  setDemoSeed(id: string): void {
    this.rng = mulberry32(hashSeed(id));
  }

  private whiteTex: THREE.Texture | null = null;

  private fallbackMask(): THREE.Texture {
    if (!this.whiteTex) {
      this.whiteTex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
      this.whiteTex.needsUpdate = true;
    }
    return this.whiteTex;
  }

  private anchorFor(hand: Landmark[]): EffectAnchor {
    const W = this.renderer.width;
    const H = this.renderer.height;
    const tr = this.renderer.videoTransform;
    const px = (u: number): number => (u * tr.repeat[0] + tr.offset[0]) * W;
    const py = (v: number): number => (v * tr.repeat[1] + tr.offset[1]) * H;
    const mcp = [hand[5], hand[9], hand[13], hand[17]].filter(Boolean) as Landmark[];
    const cx = mcp.reduce((s, p) => s + p.x, 0) / mcp.length;
    const cy = mcp.reduce((s, p) => s + p.y, 0) / mcp.length;
    const wrist = hand[0] as Landmark;
    const mid = hand[9] as Landmark;
    const size = Math.hypot(mid.x - wrist.x, mid.y - wrist.y) * W;
    return { x: px(cx), y: py(cy), size: Math.max(20, size) };
  }

  private async ensurePipelines(activeId: string, seg: boolean, face: boolean): Promise<void> {
    if (this.pipelinesFor === activeId) return;
    this.pipelinesFor = activeId;
    if (seg && !this.seg.ready) await this.seg.init().catch(() => undefined);
    if (face && !this.face.ready) await this.face.init().catch(() => undefined);
  }

  /** Stretch-mode fusion: sharingan/kurama override the hand classifier. */
  private stretchId(f: FrameInput): string | null {
    // sharingan: index tip within 1.2 eye-widths of an eye
    if (f.hands.length >= 1 && f.hands[0]) {
      const tip = f.hands[0][8];
      const eyes =
        this.face.eyes.length > 0
          ? this.face.eyes
          : f.demoEye
            ? [{ cx: 0.5, cy: 0.3, width: 0.06, ix: 0.5, iy: 0.3 }]
            : [];
      if (tip && eyes.length > 0) {
        let near = false;
        for (const e of eyes) {
          if (Math.hypot(tip.x - this.fx(e.ix), tip.y - e.iy) < 1.2 * Math.max(e.width, 1e-3)) {
            near = true;
            break;
          }
        }
        const [id] = this.sharinganStreak.update(near ? 'sharingan' : 'none', near ? 1 : 0, f.time, f.dt, this.spec);
        if (id === 'sharingan') return 'sharingan';
      }
    }
    // kurama: both fists clenched and raised (wrists above frame middle)
    if (f.hands.length === 2 && f.hands[0] && f.hands[1]) {
      const fist = (h: Landmark[]): boolean =>
        ['index', 'middle', 'ring', 'pinky'].every((k) => {
          const mcp = { index: 5, middle: 9, ring: 13, pinky: 17 }[k] ?? 5;
          const tip = { index: 8, middle: 12, ring: 16, pinky: 20 }[k] ?? 8;
          const a = h[mcp];
          const b = h[tip];
          const w = h[0];
          const m = h[9];
          if (!a || !b || !w || !m) return false;
          const size = Math.hypot(m.x - w.x, m.y - w.y) || 1e-6;
          return Math.hypot(b.x - a.x, b.y - a.y) / size < 0.45;
        });
      const h0 = f.hands[0];
      const h1 = f.hands[1];
      const raised = (h0[0]?.y ?? 1) < 0.5 && (h1[0]?.y ?? 1) < 0.5;
      const both = fist(h0) && fist(h1) && raised;
      const [id] = this.kuramaStreak.update(both ? 'kurama' : 'none', both ? 1 : 0, f.time, f.dt, this.spec);
      if (id === 'kurama') return 'kurama';
    }
    return null;
  }

  update(f: FrameInput): void {
    this.time = f.time;
    const forced = f.forceId ? (this.jutsu[f.forceId] ?? null) : null;
    const stretch = !forced && !f.demoMouth ? this.stretchId(f) : null;
    const wantId = forced?.id ?? stretch ?? f.activeId;
    const next = wantId ? (this.jutsu[wantId] ?? null) : null;
    if (next !== this.current) {
      this.current?.onDeactivate(this);
      this.current = next;
      this.holdTime = 0;
      if (this.current && f.hands[0]) {
        this.current.onActivate(this, this.anchorFor(f.hands[0]));
      }
    }
    if (!this.current) return;
    const hand = f.hands[0];
    if (!hand) return;
    const anchor = this.anchorFor(hand);
    const req = this.current.requires;

    if ((req.segmentation === true || req.face === true) && f.video) {
      void this.ensurePipelines(this.current.id, req.segmentation === true, req.face === true);
      if (req.segmentation === true) this.seg.update(f.video, performance.now());
      if (req.face === true) {
        this.face.update(f.video, performance.now());
      }
    }
    if (this.current.id === 'bunshin') {
      (this.jutsu['bunshin'] as KageBunshin).setMask(this.seg.mask ?? this.fallbackMask());
    }
    if (this.current.id === 'katon') {
      const k = this.jutsu['katon'] as Katon;
      if (f.demoMouth) {
        k.mouth = f.demoMouth;
      } else if (this.face.last) {
        const W = this.renderer.width;
        const H = this.renderer.height;
        k.mouth = {
          x: this.fx(this.face.last.mouthX) * W,
          y: this.face.last.mouthY * H,
          headPx: this.face.last.headSize * W,
        };
      }
      // charged: hold the seal 0.5 s, then fire; refire while held so the
      // effect sustains (and demo screenshots always catch a fireball)
      this.holdTime += f.dt;
      if (this.holdTime >= 0.5 && k.alive === 0) {
        k.fire(this, anchor);
      }
    }

    if (this.current.id === 'sharingan') {
      const s = this.jutsu['sharingan'];
      if (s instanceof Sharingan) {
        if (f.demoEye) {
          s.iris = f.demoEye;
        } else if (this.face.eyes.length > 0 && hand[8]) {
          const W = this.renderer.width;
          const H = this.renderer.height;
          const tip = hand[8];
          let best = this.face.eyes[0];
          let bestD = Infinity;
          for (const e of this.face.eyes) {
            const d = tip ? Math.hypot(tip.x - this.fx(e.ix), tip.y - e.iy) : Infinity;
            if (d < bestD) {
              bestD = d;
              best = e;
            }
          }
          if (best) {
            s.iris = { x: this.fx(best.ix) * W, y: best.iy * H, size: best.width * W * 1.7 };
          }
        }
      }
    }
    if (this.current.id === 'kurama') {
      const k = this.jutsu['kurama'];
      if (k instanceof KuramaCloak) {
        k.mask = this.seg.mask ?? f.demoMask ?? this.fallbackMask();
      }
    }

    this.current.update(f.dt, f.time, this, f.charge, anchor);
    this.current.render(this);
  }
}
