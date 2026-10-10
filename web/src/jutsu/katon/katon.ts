// Katon: Gokakyu. On release (charged hold), a fireball emerges at the mouth
// (FaceLandmarker lips; fallback: above the hands), grows 0.3 -> ~2.0x head
// size traveling toward the camera. Layered scrolling-noise fire, ramp
// black -> deep red -> orange -> yellow -> white core, smoke edges, embers,
// warm light cast. One-shot per activation.
import * as THREE from 'three';
import { NOISE_GLSL } from '../../render/noise';
import type { EffectAnchor, Jutsu, JutsuContext } from '../types';

const FIRE_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uGrow; // 0..1 travel progress
  ${NOISE_GLSL}
  void main() {
    vec2 c = vUv - 0.5;
    float r = length(c) * 2.0;
    // rising scroll + billow
    vec2 uv = vUv * 3.0;
    uv.y += uTime * 1.8;
    float n = fbm(uv + fbm(uv * 1.7 - uTime * 0.9) * 1.2);
    float body = smoothstep(1.0, 0.1, r + (n - 0.5) * 1.1);
    float heat = body * (0.65 + 0.35 * n);
    vec3 black = vec3(0.02, 0.0, 0.0);
    vec3 red = vec3(0.55, 0.04, 0.0);
    vec3 orange = vec3(1.0, 0.42, 0.0); // #FF6A00
    vec3 yellow = vec3(1.0, 0.75, 0.15);
    vec3 white = vec3(1.0, 1.0, 1.0);
    vec3 col = mix(black, red, smoothstep(0.0, 0.35, heat));
    col = mix(col, orange, smoothstep(0.3, 0.6, heat));
    col = mix(col, yellow, smoothstep(0.55, 0.8, heat));
    col = mix(col, white, smoothstep(0.78, 0.97, heat));
    float smoke = smoothstep(0.55, 1.0, r + (n - 0.5) * 0.7) * 0.5;
    col = mix(col, vec3(0.1), smoke * 0.7);
    float a = clamp(body + smoke * 0.4, 0.0, 1.0);
    gl_FragColor = vec4(col * a * 1.6, a);
  }
`;

const GLOW_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uIntensity;
  void main() {
    vec2 c = vUv - 0.5;
    float r = length(c) * 2.0;
    float g = pow(max(0.0, 1.0 - r), 2.0) * uIntensity;
    gl_FragColor = vec4(vec3(1.0, 0.45, 0.1) * g, g);
  }
`;

interface Fireball {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  glow: THREE.Mesh;
  glowMat: THREE.ShaderMaterial;
  t: number;
  x: number;
  y: number;
  headPx: number;
}

export class Katon implements Jutsu {
  id = 'katon';
  displayName = 'Katon: Gokakyu no Jutsu';
  character = 'Sasuke Uchiha / Itachi Uchiha';
  requires = { hands: 2, face: true };
  mouth: { x: number; y: number; headPx: number } | null = null;
  private group = new THREE.Group();
  private balls: Fireball[] = [];
  private attached = false;

  onActivate(_ctx?: JutsuContext, _anchor?: EffectAnchor): void {
    // fires on release (charged hold complete); nothing at seal time
  }

  get alive(): number {
    return this.balls.length;
  }

  /** called by the manager when the hold completes */
  fire(ctx: JutsuContext, anchor: EffectAnchor): void {
    if (!this.attached) {
      ctx.renderer.fx.add(this.group);
      this.attached = true;
    }
    const m = this.mouth;
    const x = m ? m.x : anchor.x;
    const y = m ? m.y : anchor.y - anchor.size * 1.5;
    const headPx = m ? m.headPx : anchor.size * 2;
    const mat = new THREE.ShaderMaterial({
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: FIRE_FRAG,
      uniforms: { uTime: { value: 0 }, uGrow: { value: 0 } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.frustumCulled = false;
    const glowMat = new THREE.ShaderMaterial({
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: GLOW_FRAG,
      uniforms: { uIntensity: { value: 0.8 } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat);
    glow.frustumCulled = false;
    this.group.add(mesh, glow);
    this.balls.push({ mesh, mat, glow, glowMat, t: 0, x, y, headPx });
    ctx.audio.katonBlast();
  }

  update(dt: number, time: number, ctx: JutsuContext, _charge?: number): void {
    for (const b of [...this.balls]) {
      b.t += dt;
      const life = 1.6;
      const k = Math.min(1, b.t / life);
      // grows 0.3 -> 2.0x head size, drifts up (toward camera read as growth)
      const size = b.headPx * (0.3 + 1.7 * k);
      b.mesh.position.set(b.x, b.y - k * b.headPx * 0.6, 2);
      b.mesh.scale.set(size, size, 1);
      b.glow.position.set(b.x, b.y, 1.5);
      b.glow.scale.set(size * 2.6, size * 2.6, 1);
      b.mat.uniforms['uTime']!.value = time;
      b.mat.uniforms['uGrow']!.value = k;
      b.glowMat.uniforms['uIntensity']!.value = 0.8 * (1 - k * 0.5);
      // embers
      if (ctx.rng() < 0.7 * ctx.quality.particleScale + 0.2) {
        ctx.particles.spawn({
          x: b.x + (ctx.rng() - 0.5) * size,
          y: b.y + (ctx.rng() - 0.5) * size * 0.5,
          vx: (ctx.rng() - 0.5) * 60,
          vy: -80 - ctx.rng() * 160,
          life: 0.6 + ctx.rng() * 0.8,
          size: 2 + ctx.rng() * 4,
          r: 1.0,
          g: 0.45 + ctx.rng() * 0.3,
          b: 0.1,
        });
      }
      if (b.t >= life) {
        this.group.remove(b.mesh, b.glow);
        b.mesh.geometry.dispose();
        b.glow.geometry.dispose();
        b.mat.dispose();
        b.glowMat.dispose();
        this.balls.splice(this.balls.indexOf(b), 1);
      }
    }
  }

  render(_ctx?: JutsuContext): void {
    // scene graph renders via the composer
  }

  onDeactivate(_ctx?: JutsuContext): void {
    // fireballs finish their flight even after the seal releases
  }

  dispose(): void {
    this.group.parent?.remove(this.group);
  }
}
