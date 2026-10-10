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
}

export class JutsuManager implements JutsuContext {
  renderer: OverlayRenderer;
  particles: ParticlePool;
  quality: QualityManager;
  audio: SynthAudio;
  rng: () => number = Math.random;
  time = 0;
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
    this.jutsu = { rasengan, chidori, bunshin, katon };
    // jutsus that need extra context get it here
    void bunshin;
    void katon;
  }

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

  update(f: FrameInput): void {
    this.time = f.time;
    const next = f.activeId ? (this.jutsu[f.activeId] ?? null) : null;
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
          x: this.face.last.mouthX * W,
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

    this.current.update(f.dt, f.time, this, f.charge, anchor);
    this.current.render(this);
  }
}
