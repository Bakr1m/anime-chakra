// Kurama Cloak (stretch, web only): orange-gold flame edge glow along the
// segmentation mask with animated noise displacement plus rising embers.
import * as THREE from 'three';
import { NOISE_GLSL } from '../../render/noise';
import type { EffectAnchor, Jutsu, JutsuContext } from '../types';

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uMask;
  uniform float uTime;
  uniform float uCharge;
  uniform float uMirror;
  ${NOISE_GLSL}
  void main() {
    // animated displacement for licking flames
    vec2 wob = vec2(fbm3(vUv * 6.0 + vec2(0.0, -uTime * 1.4)) - 0.5);
    vec2 uv = vUv + wob * 0.03;
    uv.x = mix(uv.x, 1.0 - uv.x, uMirror);
    float m = texture2D(uMask, uv).r;
    // edge band: inside minus eroded inside (4-tap)
    float e = 0.012;
    float m2 = texture2D(uMask, uv + vec2(e, 0.0)).r
      * texture2D(uMask, uv - vec2(e, 0.0)).r
      * texture2D(uMask, uv + vec2(0.0, e)).r
      * texture2D(uMask, uv - vec2(0.0, e)).r;
    float edge = clamp(m - m2, 0.0, 1.0) + m * 0.12;
    float flames = fbm(uv * 9.0 + vec2(0.0, -uTime * 2.2));
    float body = edge * (0.55 + 0.45 * flames);
    vec3 deep = vec3(0.9, 0.32, 0.0);    // #E65100-ish
    vec3 mid = vec3(1.0, 0.56, 0.0);     // #FF8F00
    vec3 pale = vec3(1.0, 0.84, 0.31);   // #FFD54F
    vec3 col = mix(deep, mid, body);
    col = mix(col, pale, pow(body, 2.0));
    float a = clamp(body * 1.4, 0.0, 1.0) * (0.35 + 0.65 * uCharge);
    gl_FragColor = vec4(col * a, a);
  }
`;

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export class KuramaCloak implements Jutsu {
  id = 'kurama';
  displayName = 'Kurama Cloak';
  character = 'Naruto Uzumaki';
  requires = { hands: 2, segmentation: true };
  private group = new THREE.Group();
  private mat: THREE.ShaderMaterial;
  private attached = false;
  mask: THREE.Texture | null = null;

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uMask: { value: null },
        uTime: { value: 0 },
        uCharge: { value: 0 },
        uMirror: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const W = 640;
    const H = 360;
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(W, H), this.mat);
    quad.position.set(W / 2, H / 2, 0);
    quad.frustumCulled = false;
    this.group.add(quad);
    this.group.visible = false;
  }

  onActivate(ctx: JutsuContext, _anchor: EffectAnchor): void {
    if (!this.attached) {
      ctx.renderer.fx.add(this.group);
      this.attached = true;
    }
    this.group.visible = true;
    this.fit(ctx.renderer.width, ctx.renderer.height);
  }

  private fit(W: number, H: number): void {
    const quad = this.group.children[0] as THREE.Mesh;
    quad.scale.set(W / 640, H / 360, 1);
    quad.position.set(W / 2, H / 2, 0);
  }

  update(dt: number, time: number, ctx: JutsuContext, charge: number, anchor: EffectAnchor): void {
    this.fit(ctx.renderer.width, ctx.renderer.height);
    this.mat.uniforms['uMask']!.value = this.mask;
    this.mat.uniforms['uTime']!.value = time;
    this.mat.uniforms['uCharge']!.value = charge;
    this.mat.uniforms['uMirror']!.value = ctx.mirrored ? 1 : 0;
    // rising embers along the silhouette
    const n = Math.ceil(3 * ctx.quality.particleScale);
    for (let i = 0; i < n; i++) {
      ctx.particles.spawn({
        x: anchor.x + (ctx.rng() - 0.5) * anchor.size * 3,
        y: anchor.y + (ctx.rng() - 0.5) * anchor.size * 2,
        vx: (ctx.rng() - 0.5) * 30,
        vy: -60 - ctx.rng() * 120,
        life: 0.8 + ctx.rng() * 0.8,
        size: 2 + ctx.rng() * 3,
        r: 1.0,
        g: 0.55 + ctx.rng() * 0.25,
        b: 0.15,
      });
    }
    void dt;
  }

  render(_ctx?: JutsuContext): void {
    // scene graph renders via the composer
  }

  onDeactivate(_ctx?: JutsuContext): void {
    this.group.visible = false;
  }

  dispose(): void {
    this.group.parent?.remove(this.group);
  }
}
