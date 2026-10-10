// Sharingan (stretch, web only): red radial iris with three orbiting tomoe,
// a dark pupil ring and thin outer ring. Positioned on the iris landmarks,
// clipped by an elliptical eyelid mask.
import * as THREE from 'three';
import type { EffectAnchor, Jutsu, JutsuContext } from '../types';

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  void main() {
    vec2 c = (vUv - 0.5) * 2.0;
    float r = length(c);
    // eyelid clip: horizontal ellipse
    vec2 e = vec2(c.x, c.y * 1.9);
    float lid = smoothstep(1.0, 0.85, length(e));
    if (lid <= 0.001) discard;
    // iris base: dark red edge -> bright red mid
    vec3 edge = vec3(0.55, 0.0, 0.0);   // #8B0000
    vec3 mid = vec3(0.84, 0.0, 0.0);    // #D50000
    vec3 col = mix(mid, edge, smoothstep(0.2, 1.0, r));
    // pupil ring
    float pupil = smoothstep(0.34, 0.28, r);
    col = mix(col, vec3(0.02), pupil);
    // three orbiting tomoe
    float tomoe = 0.0;
    for (int i = 0; i < 3; i++) {
      float a = uTime * 1.8 + float(i) * 2.094;
      vec2 tp = vec2(cos(a), sin(a)) * 0.52;
      float d = length(c - tp);
      tomoe += smoothstep(0.22, 0.1, d);
    }
    col = mix(col, vec3(0.02), clamp(tomoe, 0.0, 1.0) * (1.0 - pupil));
    // thin outer ring
    float ring = smoothstep(0.04, 0.0, abs(r - 0.97));
    col += vec3(0.3, 0.0, 0.0) * ring;
    gl_FragColor = vec4(col * lid, lid);
  }
`;

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export class Sharingan implements Jutsu {
  id = 'sharingan';
  displayName = 'Sharingan';
  character = 'Sasuke Uchiha / Kakashi Hatake';
  requires = { hands: 1, face: true };
  /** set by the manager each frame from iris landmarks (screen px) */
  iris: { x: number; y: number; size: number } | null = null;
  private group = new THREE.Group();
  private mat: THREE.ShaderMaterial;
  private attached = false;

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat);
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
  }

  update(_dt: number, time: number, _ctx: JutsuContext, _charge: number, _anchor: EffectAnchor): void {
    if (!this.iris) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    this.group.position.set(this.iris.x, this.iris.y, 3);
    this.group.scale.set(this.iris.size, this.iris.size, 1);
    this.mat.uniforms['uTime']!.value = time;
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
