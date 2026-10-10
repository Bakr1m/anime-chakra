// Rasengan: dense chakra sphere over the palm. Core near-white fading to
// cyan-blue, fast rotating spiral streaks (domain-warped fBm in polar
// coordinates), counter-rotating shell, fresnel rim, orbiting particles,
// spring wobble following the hand, blue light cast on nearby video.
import * as THREE from 'three';
import { NOISE_GLSL } from '../../render/noise';
import type { EffectAnchor, Jutsu, JutsuContext } from '../types';

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uCharge;
  uniform float uSpin;
  ${NOISE_GLSL}
  void main() {
    vec2 c = vUv - 0.5;
    float r = length(c) * 2.0;
    if (r > 1.0) discard;
    float theta = atan(c.y, c.x);
    // domain-warped spiral: streaks rotate fast, shell counter-rotates
    float warp = fbm(vec2(theta * 1.5 + uTime * 0.7, r * 3.0 - uTime * 0.4));
    float spiral = fbm(vec2(theta * 3.0 - uTime * uSpin + warp * 4.0, r * 6.0));
    float shell = fbm(vec2(theta * -2.0 + uTime * uSpin * 0.6, r * 4.0 + 7.0));
    float fresnel = pow(1.0 - r, 1.5);
    float body = smoothstep(1.0, 0.15, r);
    float streaks = smoothstep(0.35, 0.9, spiral) * body;
    vec3 white = vec3(1.0, 1.0, 1.0);
    vec3 mid = vec3(0.31, 0.76, 1.0);   // #4FC3FF
    vec3 edge = vec3(0.08, 0.39, 0.75); // #1565C0
    vec3 col = mix(edge, mid, body);
    col = mix(col, white, pow(fresnel, 2.0) * 0.9 + streaks * 0.35);
    col += vec3(0.2, 0.5, 1.0) * shell * 0.35 * body;
    float pulse = 0.85 + 0.15 * sin(uTime * 9.0) * (1.0 - uCharge);
    float alpha = clamp(body * 1.15 + streaks * 0.5 + fresnel * 0.35, 0.0, 1.0) * pulse;
    gl_FragColor = vec4(col * alpha * (0.6 + 0.9 * uCharge), alpha);
  }
`;

const LIGHT_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uCharge;
  void main() {
    vec2 c = vUv - 0.5;
    float r = length(c) * 2.0;
    float glow = pow(max(0.0, 1.0 - r), 2.2) * 0.5 * uCharge;
    gl_FragColor = vec4(vec3(0.25, 0.55, 1.0) * glow, glow);
  }
`;

export class Rasengan implements Jutsu {
  id = 'rasengan';
  displayName = 'Rasengan';
  character = 'Naruto Uzumaki';
  requires = { hands: 1 };
  private group = new THREE.Group();
  private mat: THREE.ShaderMaterial;
  private lightMat: THREE.ShaderMaterial;
  private wobble = { x: 0, y: 0, vx: 0, vy: 0 };
  private spin = 3.0;
  private attached = false;

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uCharge: { value: 0 },
        uSpin: { value: this.spin },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ball = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat);
    ball.frustumCulled = false;
    this.group.add(ball);
    this.lightMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: LIGHT_FRAG,
      uniforms: { uCharge: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const light = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.lightMat);
    light.frustumCulled = false;
    light.position.z = -0.5;
    this.group.add(light);
    this.group.visible = false;
  }

  onActivate(ctx: JutsuContext, anchor: EffectAnchor): void {
    if (!this.attached) {
      ctx.renderer.fx.add(this.group);
      this.attached = true;
    }
    this.wobble.x = anchor.x;
    this.wobble.y = anchor.y;
    this.group.visible = true;
    ctx.audio.rasenganStart();
  }

  update(dt: number, time: number, ctx: JutsuContext, charge: number, anchor: EffectAnchor): void {
    // spring-physics wobble toward the hand
    const k = 90;
    const d = 12;
    this.wobble.vx += ((anchor.x - this.wobble.x) * k - this.wobble.vx * d) * dt;
    this.wobble.vy += ((anchor.y - this.wobble.y) * k - this.wobble.vy * d) * dt;
    this.wobble.x += this.wobble.vx * dt;
    this.wobble.y += this.wobble.vy * dt;

    const radius = anchor.size * 0.9 * (0.7 + 0.3 * charge);
    this.group.position.set(this.wobble.x, this.wobble.y, 1);
    this.group.scale.set(radius * 2, radius * 2, 1);
    this.mat.uniforms['uTime']!.value = time;
    this.mat.uniforms['uCharge']!.value = charge;
    this.lightMat.uniforms['uCharge']!.value = charge;
    const light = this.group.children[1] as THREE.Mesh;
    light.scale.set(3.2, 3.2, 1);

    // orbiting particles on tight shells + a few tangential wisps
    const budget = Math.floor((250 + 150 * charge) * ctx.quality.particleScale);
    const spawn = Math.min(budget - ctx.particles.alive, Math.ceil(240 * dt * ctx.quality.particleScale) + 1);
    for (let i = 0; i < spawn; i++) {
      const a = ctx.rng() * Math.PI * 2;
      const rr = radius * (0.75 + ctx.rng() * 0.45);
      const speed = (2.5 + ctx.rng() * 3.5) * (ctx.rng() > 0.85 ? -1 : 1);
      ctx.particles.spawn({
        x: this.wobble.x + Math.cos(a) * rr,
        y: this.wobble.y + Math.sin(a) * rr,
        vx: -Math.sin(a) * rr * speed,
        vy: Math.cos(a) * rr * speed,
        life: 0.5 + ctx.rng() * 0.5,
        size: 3 + ctx.rng() * 5,
        r: 0.45,
        g: 0.78,
        b: 1.0,
      });
    }
  }

  render(_ctx?: JutsuContext): void {
    // scene graph renders via the composer; nothing per-frame here
  }

  onDeactivate(ctx: JutsuContext): void {
    this.group.visible = false;
    ctx.audio.rasenganStop();
  }

  dispose(): void {
    this.group.parent?.remove(this.group);
  }
}
