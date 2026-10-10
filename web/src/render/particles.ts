// CPU particle pool rendered as one additive THREE.Points draw call.
import * as THREE from 'three';

export interface ParticleSpawn {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  r: number;
  g: number;
  b: number;
  gravity?: number;
  drag?: number;
}

const VERT = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aAlpha;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (300.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv) * 2.0;
    float a = smoothstep(1.0, 0.1, d) * vAlpha;
    gl_FragColor = vec4(vColor * a, a);
  }
`;

export class ParticlePool {
  readonly points: THREE.Points;
  private max: number;
  private count = 0;
  private pos: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private life0: Float32Array;
  private size: Float32Array;
  private col: Float32Array;
  private alpha: Float32Array;
  private grav: Float32Array;
  private drag: Float32Array;
  private geo: THREE.BufferGeometry;
  private mat: THREE.ShaderMaterial;

  constructor(max = 1024) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 2);
    this.life = new Float32Array(max);
    this.life0 = new Float32Array(max);
    this.size = new Float32Array(max);
    this.col = new Float32Array(max * 3);
    this.alpha = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
  }

  get alive(): number {
    return this.count;
  }

  spawn(p: ParticleSpawn): void {
    if (this.count >= this.max) return;
    const i = this.count++;
    this.pos[i * 3] = p.x;
    this.pos[i * 3 + 1] = p.y;
    this.pos[i * 3 + 2] = 0;
    this.vel[i * 2] = p.vx;
    this.vel[i * 2 + 1] = p.vy;
    this.life[i] = p.life;
    this.life0[i] = p.life;
    this.size[i] = p.size;
    this.col[i * 3] = p.r;
    this.col[i * 3 + 1] = p.g;
    this.col[i * 3 + 2] = p.b;
    this.grav[i] = p.gravity ?? 0;
    this.drag[i] = p.drag ?? 0;
  }

  update(dt: number): void {
    const g = (a: Float32Array, i: number): number => a[i] ?? 0;
    let i = 0;
    while (i < this.count) {
      this.life[i] = g(this.life, i) - dt;
      if (g(this.life, i) <= 0) {
        const last = --this.count;
        for (let k = 0; k < 3; k++) {
          this.pos[i * 3 + k] = g(this.pos, last * 3 + k);
          this.col[i * 3 + k] = g(this.col, last * 3 + k);
        }
        this.vel[i * 2] = g(this.vel, last * 2);
        this.vel[i * 2 + 1] = g(this.vel, last * 2 + 1);
        this.life[i] = g(this.life, last);
        this.life0[i] = g(this.life0, last);
        this.size[i] = g(this.size, last);
        this.grav[i] = g(this.grav, last);
        this.drag[i] = g(this.drag, last);
        continue;
      }
      const dragF = 1 - Math.min(0.9, g(this.drag, i) * dt);
      const vx = g(this.vel, i * 2) * dragF;
      const vy = g(this.vel, i * 2 + 1) * dragF + g(this.grav, i) * dt;
      this.vel[i * 2] = vx;
      this.vel[i * 2 + 1] = vy;
      this.pos[i * 3] = g(this.pos, i * 3) + vx * dt;
      this.pos[i * 3 + 1] = g(this.pos, i * 3 + 1) + vy * dt;
      this.alpha[i] = Math.max(0, g(this.life, i) / Math.max(g(this.life0, i), 1e-6));
      i++;
    }
    this.geo.setDrawRange(0, this.count);
    (this.geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('aColor') as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('aAlpha') as THREE.BufferAttribute).needsUpdate = true;
  }

  clear(): void {
    this.count = 0;
    this.geo.setDrawRange(0, 0);
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}
