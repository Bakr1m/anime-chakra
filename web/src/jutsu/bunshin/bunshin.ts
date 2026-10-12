// Kage Bunshin: cross seal -> white poof billboards at 2-4 clone spots, then
// lagged clone layers (the live video frame, segmentation-masked, offset
// left/right, 85% opacity, slight desaturation, 150-400 ms lag). After ~5 s
// each clone dissolves in another poof.
import * as THREE from 'three';
import { NOISE_GLSL } from '../../render/noise';
import type { EffectAnchor, Jutsu, JutsuContext } from '../types';

const POOF_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const POOF_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uLife;
  ${NOISE_GLSL}
  void main() {
    vec2 c = vUv - 0.5;
    float r = length(c) * 2.0;
    float n = fbm(vUv * 5.0 + uTime * 1.5);
    float edge = smoothstep(1.0, 0.25, r + (n - 0.5) * 0.9);
    float a = edge * uLife;
    gl_FragColor = vec4(vec3(1.0) * a, a);
  }
`;

export const CLONE_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uVideo;
  uniform sampler2D uMask;
  uniform vec2 uRepeat;
  uniform vec2 uBaseOffset;
  uniform vec2 uShift;
  uniform float uOpacity;
  uniform float uDissolve;
  uniform float uMirror;
  void main() {
    vec2 uv = vUv * uRepeat + uBaseOffset + uShift;
    uv.x = mix(uv.x, 1.0 - uv.x, uMirror);
    vec4 vid = texture2D(uVideo, uv);
    float m = texture2D(uMask, uv).r;
    float gray = dot(vid.rgb, vec3(0.33));
    vec3 col = mix(vid.rgb, vec3(gray), 0.25) * uOpacity * 1.15;
    float a = m * uOpacity * (1.0 - uDissolve);
    gl_FragColor = vec4(col * a, a);
  }
`;

interface Poof {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  life: number;
  size: number;
}

interface CloneLayer {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  born: number;
  lag: number;
  side: number;
}

export class KageBunshin implements Jutsu {
  id = 'bunshin';
  displayName = 'Kage Bunshin no Jutsu';
  character = 'Naruto Uzumaki';
  requires = { hands: 2, segmentation: true };
  private group = new THREE.Group();
  private poofs: Poof[] = [];
  private clones: CloneLayer[] = [];
  private history: { t: number; x: number }[] = [];
  private attached = false;
  private maskTex: THREE.Texture | null = null;

  setMask(tex: THREE.Texture | null): void {
    this.maskTex = tex;
  }

  onActivate(ctx: JutsuContext, anchor: EffectAnchor): void {
    if (!this.attached) {
      ctx.renderer.fx.add(this.group);
      this.attached = true;
    }
    this.history = [];
    ctx.audio.poof();
    const W = ctx.renderer.width;
    const H = ctx.renderer.height;
    const videoTex = ctx.renderer.videoTexture;
    for (const side of [-1.6, 1.6]) {
      this.spawnPoof(anchor.x + side * anchor.size, anchor.y, anchor.size * 2.6);
      if (videoTex) {
        const mat = new THREE.ShaderMaterial({
          vertexShader: POOF_VERT,
          fragmentShader: CLONE_FRAG,
          uniforms: {
            uVideo: { value: videoTex },
            uMask: { value: this.maskTex },
            uRepeat: { value: new THREE.Vector2(1, 1) },
            uBaseOffset: { value: new THREE.Vector2(0, 0) },
            uShift: { value: new THREE.Vector2(side * 0.18, 0) },
            uOpacity: { value: 0.85 },
            uDissolve: { value: 0 },
            uMirror: { value: 0 },
          },
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat);
        mesh.position.set(W / 2, H / 2, 0);
        mesh.frustumCulled = false;
        this.group.add(mesh);
        this.clones.push({ mesh, mat, born: ctx.time, lag: side < 0 ? 0.15 : 0.4, side });
      }
    }
  }

  private spawnPoof(x: number, y: number, size: number): void {
    const mat = new THREE.ShaderMaterial({
      vertexShader: POOF_VERT,
      fragmentShader: POOF_FRAG,
      uniforms: { uTime: { value: 0 }, uLife: { value: 1 } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    mesh.position.set(x, y, 1);
    mesh.frustumCulled = false;
    this.group.add(mesh);
    this.poofs.push({ mesh, mat, life: 1, size });
  }

  update(dt: number, time: number, ctx: JutsuContext, _charge: number, anchor: EffectAnchor): void {
    this.history.push({ t: time, x: anchor.x });
    if (this.history.length > 60) this.history.shift();
    for (const p of [...this.poofs]) {
      p.life -= dt * 0.45;
      p.mat.uniforms['uLife']!.value = Math.max(0, p.life);
      p.mat.uniforms['uTime']!.value = time;
      const s = p.size * (1.4 - 0.4 * Math.max(0, p.life));
      p.mesh.scale.set(s / p.size, s / p.size, 1);
      if (p.life <= 0) {
        this.group.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mat.dispose();
        this.poofs.splice(this.poofs.indexOf(p), 1);
      }
    }
    const tr = ctx.renderer.videoTransform;
    for (const c of this.clones) {
      if (this.maskTex) c.mat.uniforms['uMask']!.value = this.maskTex;
      c.mat.uniforms['uMirror']!.value = ctx.mirrored ? 1 : 0;
      (c.mat.uniforms['uRepeat']!.value as THREE.Vector2).set(tr.repeat[0], tr.repeat[1]);
      (c.mat.uniforms['uBaseOffset']!.value as THREE.Vector2).set(tr.offset[0], tr.offset[1]);
      // lagged horizontal parallax from the anchor history
      const target = time - c.lag;
      let hx = anchor.x;
      for (let i = this.history.length - 1; i >= 0; i--) {
        const h = this.history[i];
        if (h && h.t <= target) {
          hx = h.x;
          break;
        }
      }
      const parallax = (anchor.x - hx) / Math.max(1, ctx.renderer.width);
      (c.mat.uniforms['uShift']!.value as THREE.Vector2).set(c.side * 0.18 - parallax * 0.5, 0);
      const age = time - c.born;
      if (age > 5) {
        c.mat.uniforms['uDissolve']!.value = Math.min(1, (age - 5) / 0.6);
      }
    }
  }

  render(_ctx: JutsuContext): void {
    // scene graph renders via the composer
  }

  onDeactivate(ctx: JutsuContext): void {
    for (const c of this.clones) {
      const pos = new THREE.Vector3();
      c.mesh.getWorldPosition(pos);
      this.spawnPoof(pos.x, pos.y, 160);
      this.group.remove(c.mesh);
      c.mat.dispose();
    }
    this.clones = [];
    void ctx;
  }

  dispose(): void {
    this.group.parent?.remove(this.group);
  }
}
