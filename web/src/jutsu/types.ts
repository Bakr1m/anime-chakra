// Jutsu interface. Adding a jutsu = one folder + one entry in spec/gestures.json.
import type { OverlayRenderer } from '../render/renderer';
import type { ParticlePool } from '../render/particles';
import type { QualityManager } from '../render/quality';
import type { SynthAudio } from '../audio/voices';

export interface EffectAnchor {
  /** screen pixels, y down */
  x: number;
  y: number;
  /** hand size in screen pixels: effect scale unit, never fixed pixels */
  size: number;
}

export interface JutsuContext {
  renderer: OverlayRenderer;
  particles: ParticlePool;
  quality: QualityManager;
  audio: SynthAudio;
  rng: () => number;
  /** current scene time in seconds (demo-safe; do not use performance.now) */
  time: number;
}

export interface JutsuRequires {
  hands: number;
  segmentation?: boolean;
  face?: boolean;
}

export interface Jutsu {
  id: string;
  displayName: string;
  character: string;
  requires: JutsuRequires;
  onActivate(ctx: JutsuContext, anchor: EffectAnchor): void;
  update(dt: number, time: number, ctx: JutsuContext, charge: number, anchor: EffectAnchor): void;
  render(ctx: JutsuContext): void;
  onDeactivate(ctx: JutsuContext): void;
  dispose(): void;
}
