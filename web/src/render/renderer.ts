// Three.js overlay renderer: live video background, additive effect layers,
// UnrealBloomPass, screen shake and luminance flash.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export class OverlayRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  /** effect layers attach here (pixel space, y down, origin top-left) */
  readonly fx = new THREE.Group();
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private videoTex: THREE.Texture | null = null;
  private videoQuad: THREE.Mesh | null = null;
  private flashMat: THREE.MeshBasicMaterial;
  private flashMesh: THREE.Mesh;
  private flashBudget = 0;
  private flashWindow = 0;
  reducedMotion = false;
  private shake = 0;
  private W = 1280;
  private H = 720;

  constructor(canvas: HTMLCanvasElement) {
    const demo = typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo');
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: demo,
    });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.camera = new THREE.OrthographicCamera(0, this.W, 0, this.H, -10, 10);
    this.camera.position.set(0, 0, 5);
    this.scene.add(this.fx);
    this.flashMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      side: THREE.DoubleSide,
    });
    this.flashMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.flashMat);
    this.flashMesh.position.set(this.W / 2, this.H / 2, 9);
    this.flashMesh.scale.set(this.W, this.H, 1);
    this.flashMesh.frustumCulled = false;
    this.scene.add(this.flashMesh);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(this.W, this.H), 0.45, 0.35, 0.65);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.resize(this.W, this.H);
  }

  attachVideo(video: HTMLVideoElement): void {
    const tex = new THREE.VideoTexture(video);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.attachTexture(tex, video.videoWidth || 1280, video.videoHeight || 720);
  }

  /** demo/headless path: attach any texture as the background */
  attachTexture(tex: THREE.Texture, vw: number, vh: number): void {
    this.videoTex = tex;
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide });
    if (this.videoQuad) {
      this.scene.remove(this.videoQuad);
      (this.videoQuad.material as THREE.Material).dispose();
      this.videoQuad.geometry.dispose();
    }
    this.videoQuad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    this.videoQuad.position.set(this.W / 2, this.H / 2, -5);
    this.videoQuad.frustumCulled = false;
    this.scene.add(this.videoQuad);
    this.layoutVideo(vw, vh);
  }

  /** front-camera selfie preview: mirrored like every camera app */
  mirrored = false;

  setMirrored(mirror: boolean): void {
    this.mirrored = mirror;
    if (this.videoQuad) {
      this.videoQuad.scale.set(this.mirrored ? -this.W : this.W, this.H, 1);
    }
  }
  /** cover-fit the video quad into the pixel-space frustum */
  layoutVideo(vw: number, vh: number): void {
    if (!this.videoQuad || !this.videoTex) return;
    const canvasAspect = this.W / this.H;
    const videoAspect = vw / vh;
    let rx = 1;
    let ry = 1;
    if (videoAspect > canvasAspect) {
      rx = canvasAspect / videoAspect;
    } else {
      ry = videoAspect / canvasAspect;
    }
    this.videoTex.repeat.set(rx, ry);
    this.videoTex.offset.set((1 - rx) / 2, (1 - ry) / 2);
    this.videoQuad.scale.set(this.mirrored ? -this.W : this.W, this.H, 1);
  }

  resize(w: number, h: number, pixelRatio = 1): void {
    this.W = Math.max(2, Math.round(w));
    this.H = Math.max(2, Math.round(h));
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(this.W, this.H, false);
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(this.W, this.H);
    // y-down screen space: world y=0 is the top of the screen, matching
    // MediaPipe normalized coords (y down) used by every anchor and effect
    this.camera.left = 0;
    this.camera.right = this.W;
    this.camera.top = 0;
    this.camera.bottom = this.H;
    this.camera.updateProjectionMatrix();
    if (this.videoQuad) {
      this.videoQuad.scale.set(this.mirrored ? -this.W : this.W, this.H, 1);
      this.videoQuad.position.set(this.W / 2, this.H / 2, -5);
    }
    this.flashMesh.position.set(this.W / 2, this.H / 2, 9);
    this.flashMesh.scale.set(this.W, this.H, 1);
  }

  setBloomEnabled(on: boolean): void {
    this.bloom.enabled = on;
  }

  addFlash(amount: number, color = 0xffffff): void {
    // photosensitivity guard: at most ~2 full flashes per second
    const now = performance.now() / 1000;
    if (now - this.flashWindow > 1) {
      this.flashWindow = now;
      this.flashBudget = 0;
    }
    this.flashBudget += amount;
    const cap = this.reducedMotion ? 0.06 : this.flashBudget > 2 ? amount * 0.25 : amount;
    this.flashMat.color.setHex(color);
    // set-max (not accumulate): callers pass an instantaneous level every
    // frame, so high-fps machines cannot ratchet to a stuck white screen
    this.flashMat.opacity = Math.min(1, Math.max(this.flashMat.opacity, cap));
  }

  addShake(px: number): void {
    if (this.reducedMotion) return;
    this.shake = Math.min(8, this.shake + px);
  }

  render(dt: number): void {
    this.flashMat.opacity = Math.max(0, this.flashMat.opacity - dt * 6);
    if (this.shake > 0.05) {
      this.camera.position.x = (Math.random() - 0.5) * 2 * this.shake;
      this.camera.position.y = (Math.random() - 0.5) * 2 * this.shake;
      this.shake *= Math.exp(-6 * dt);
    } else {
      this.camera.position.x = 0;
      this.camera.position.y = 0;
    }
    this.composer.render();
  }

  get videoTexture(): THREE.Texture | null {
    return this.videoTex;
  }

  /** cover-fit UV transform currently applied to the video texture */
  get videoTransform(): { repeat: [number, number]; offset: [number, number] } {
    if (!this.videoTex) return { repeat: [1, 1], offset: [0, 0] };
    return {
      repeat: [this.videoTex.repeat.x, this.videoTex.repeat.y],
      offset: [this.videoTex.offset.x, this.videoTex.offset.y],
    };
  }

  get width(): number {
    return this.W;
  }

  get height(): number {
    return this.H;
  }

  dispose(): void {
    this.videoTex?.dispose();
    this.renderer.dispose();
  }
}
