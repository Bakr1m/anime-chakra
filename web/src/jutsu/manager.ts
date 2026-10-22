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
import { KuramaCloak } from './kurama/kurama';
import { JutsuState } from '../gestures/stateMachine';
import { matchKurama } from '../gestures/rules';
import { getSpec, rulesFor } from '../gestures/spec';
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
    const kurama = new KuramaCloak();
    this.jutsu = { rasengan, chidori, bunshin, katon, kurama };
    this.spec = getSpec();
    this.katonHold = this.spec.jutsu.find((j) => j.id === 'katon')?.holdSeconds ?? 0.5;
  }

  private spec: ReturnType<typeof getSpec>;
  private kuramaStreak = new JutsuState();
  private katonHold = 0.5;
  private displayCharge = 0;

  /** HUD view of the jutsu actually rendering: stretch gestures (kurama)
   *  never reach the state machine, so they report their own charge ramp. */
  get currentId(): string | null {
    return this.current?.id ?? null;
  }

  get charge(): number {
    return this.displayCharge;
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

  private faceAttemptAt = -10;
  private segAttemptAt = -10;
  private faceTick = 0;
  private segTick = 0;

  /** Start face/seg as soon as hands are visible — never gated on the
   *  active jutsu (gating on it delays Katon's mouth anchor and Kurama's
   *  cloak mask until after activation). Attempts throttled to 5 s;
   *  per-frame work is throttled here: face every 4th frame (~15 Hz),
   *  seg every 3rd frame (~20 Hz) only while two hands are visible (its
   *  mask is only consumed by 2-hand jutsu). Running both graphs every
   *  frame alongside hands was a measurable source of camera lag. Demo
   *  passes no video and is unaffected. */
  private primePipelines(f: FrameInput): void {
    if (!f.video || f.hands.length === 0) return;
    const nowS = performance.now() / 1000;
    if (!this.face.ready && nowS - this.faceAttemptAt > 5) {
      this.faceAttemptAt = nowS;
      void this.face.init().catch(() => undefined);
    }
    if (f.hands.length === 2 && !this.seg.ready && nowS - this.segAttemptAt > 5) {
      this.segAttemptAt = nowS;
      void this.seg.init().catch(() => undefined);
    }
    if (this.face.ready) {
      this.faceTick++;
      if (this.faceTick % 4 === 0) this.face.update(f.video, performance.now());
    }
    if (this.seg.ready && f.hands.length === 2) {
      this.segTick++;
      if (this.segTick % 3 === 0) this.seg.update(f.video, performance.now());
    }
  }

  /** Stretch-mode fusion: kurama overrides the hand classifier. The streak
   *  is ALWAYS updated (even with <2 hands) so losing the pose releases with
   *  the normal hysteresis instead of freezing or flickering off instantly. */
  private stretchId(f: FrameInput): string | null {
    const both = matchKurama(f.hands, rulesFor(this.spec, 'kurama'));
    const [id] = this.kuramaStreak.update(
      both ? 'kurama' : 'none',
      both ? 1 : 0,
      f.time,
      f.dt,
      this.spec,
    );
    return id === 'kurama' ? 'kurama' : null;
  }

  update(f: FrameInput): void {
    this.time = f.time;
    this.primePipelines(f);
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
    // charge: the state machine drives it while it tracks this jutsu; a
    // stretch jutsu (invisible to the state machine) ramps on its own with
    // the same ease-out tau so effects never render stuck at zero.
    if (!this.current) {
      this.displayCharge = 0;
    } else if (f.activeId === this.current.id) {
      this.displayCharge = f.charge;
    } else {
      const tau = this.spec.reliability.chargeSeconds / 3 || 0.2;
      this.displayCharge += (1 - this.displayCharge) * Math.min(1, f.dt / tau);
      this.displayCharge = Math.min(this.displayCharge, 1);
    }
    if (!this.current) return;
    const hand = f.hands[0];
    if (!hand) return;
    const anchor = this.anchorFor(hand);

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
      // charged: hold the seal (spec holdSeconds), then fire; refire while held
      // so the effect sustains (and demo screenshots always catch a fireball)
      this.holdTime += f.dt;
      if (this.holdTime >= this.katonHold && k.alive === 0) {
        k.fire(this, anchor);
      }
    }

    if (this.current.id === 'kurama') {
      const k = this.jutsu['kurama'];
      if (k instanceof KuramaCloak) {
        k.mask = this.seg.mask ?? f.demoMask ?? this.fallbackMask();
      }
    }

    this.current.update(f.dt, f.time, this, this.displayCharge, anchor);
    this.current.render(this);
  }
}
