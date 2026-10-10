// Chidori: blue-white bolts from palm/fingertips into a forward cone plus a
// few sideways. Regenerated every 2-3 frames (~30 Hz flicker) from a seeded
// RNG, hot glowing core, gravity sparks, flash + screen shake with charge.
import * as THREE from 'three';
import { mulberry32 } from '../../render/clock';
import type { EffectAnchor, Jutsu, JutsuContext } from '../types';
import { buildBolt, type BoltPoint } from './lightning';

export class Chidori implements Jutsu {
  id = 'chidori';
  displayName = 'Chidori';
  character = 'Sasuke Uchiha / Kakashi Hatake';
  requires = { hands: 1 };
  private group = new THREE.Group();
  private coreMat: THREE.LineBasicMaterial;
  private glowMat: THREE.LineBasicMaterial;
  private coreLines: THREE.Line[] = [];
  private glowLines: THREE.Line[] = [];
  private frame = 0;
  private seed = 1;
  private attached = false;

  constructor() {
    this.coreMat = new THREE.LineBasicMaterial({
      color: 0xbfe9ff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthTest: false,
    });
    this.glowMat = new THREE.LineBasicMaterial({
      color: 0x4da3ff,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthTest: false,
    });
    this.group.visible = false;
  }

  onActivate(ctx: JutsuContext, _anchor: EffectAnchor): void {
    if (!this.attached) {
      ctx.renderer.fx.add(this.group);
      this.attached = true;
    }
    this.group.visible = true;
    this.seed = (Math.random() * 1e9) | 0;
    ctx.audio.chidoriStart();
  }

  update(_dt: number, _time: number, ctx: JutsuContext, charge: number, anchor: EffectAnchor): void {
    this.frame++;
    // regenerate every 2-3 frames for ~30 Hz flicker; seed advances deterministically
    if (this.frame % 2 === 0) {
      this.seed = (this.seed + 1) >>> 0;
      this.rebuild(ctx, charge, anchor);
    }
    // gravity sparks from the fingertips
    const n = Math.ceil((2 + charge * 5) * ctx.quality.particleScale);
    for (let i = 0; i < n; i++) {
      ctx.particles.spawn({
        x: anchor.x + (ctx.rng() - 0.5) * anchor.size,
        y: anchor.y + (ctx.rng() - 0.5) * anchor.size,
        vx: (ctx.rng() - 0.5) * 260,
        vy: -ctx.rng() * 320,
        life: 0.3 + ctx.rng() * 0.5,
        size: 2 + ctx.rng() * 4,
        r: 0.75,
        g: 0.91,
        b: 1.0,
        gravity: 900,
      });
    }
    ctx.renderer.addFlash(0.06 * charge, 0x4da3ff);
    ctx.renderer.addShake(2.5 * charge);
  }

  private rebuild(_ctx: JutsuContext, charge: number, anchor: EffectAnchor): void {
    for (const l of [...this.coreLines, ...this.glowLines]) {
      this.group.remove(l);
      l.geometry.dispose();
    }
    this.coreLines = [];
    this.glowLines = [];
    const rand = mulberry32(this.seed);
    const reach = anchor.size * (1.6 + charge * 1.2);
    // forward cone: direction of the fingers (up on screen here); sideways few
    // forward cone (screen-up) plus a few sideways; bloom widens them
    const dirs = [90 - 25, 90 - 8, 90 + 8, 90 + 25, 90 + 160, 90 - 160];
    for (const deg of dirs) {
      const rad = (deg * Math.PI) / 180;
      const from: BoltPoint = { x: anchor.x, y: anchor.y };
      const to: BoltPoint = {
        x: anchor.x + Math.cos(rad) * reach * (0.7 + rand() * 0.6),
        y: anchor.y - Math.sin(rad) * reach * (0.7 + rand() * 0.6),
      };
      const bolts = buildBolt(from, to, rand, 3 + Math.floor(rand() * 3));
      for (const b of bolts) {
        const geo = new THREE.BufferGeometry().setFromPoints(b.map((p) => new THREE.Vector3(p.x, p.y, 1)));
        const core = new THREE.Line(geo, this.coreMat);
        const glow = new THREE.Line(geo.clone(), this.glowMat); // bloom pass widens this into the glow
        core.frustumCulled = false;
        glow.frustumCulled = false;
        this.group.add(core, glow);
        this.coreLines.push(core);
        this.glowLines.push(glow);
      }
    }
  }

  render(_ctx?: JutsuContext): void {
    // scene graph renders via the composer
  }

  onDeactivate(ctx: JutsuContext): void {
    this.group.visible = false;
    ctx.audio.chidoriStop();
  }

  dispose(): void {
    this.group.parent?.remove(this.group);
  }
}
