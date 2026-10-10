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
  private videoTex: THREE.VideoTexture | null = null;
  private videoQuad: THREE.Mesh | null = null;
  private flashMat: THREE.MeshBasicMaterial;
  private shake = 0;
  private W = 1280;
  private H = 720;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.camera = new THREE.OrthographicCamera(0, this.W, 0, this.H, -10, 10);
    this.camera.position.set(0, 0, 5);
    this.scene.add(this.fx);
    this.flashMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthTest: false,
    });
    const flash = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.flashMat);
    flash.position.set(0.5, 0.5, 9);
    flash.scale.set(2, 2, 1);
    flash.frustumCulled = false;
    this.scene.add(flash);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(this.W, this.H), 0.9, 0.55, 0.12);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.resize(this.W, this.H);
  }

  attachVideo(video: HTMLVideoElement): void {
    this.videoTex = new THREE.VideoTexture(video);
    this.videoTex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: this.videoTex, toneMapped: false });
    this.videoQuad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    this.videoQuad.position.set(0.5, 0.5, -5);
    this.videoQuad.frustumCulled = false;
    this.scene.add(this.videoQuad);
    this.layoutVideo(video.videoWidth || 1280, video.videoHeight || 720);
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
    this.videoQuad.scale.set(this.W, this.H, 1);
  }

  resize(w: number, h: number, pixelRatio = 1): void {
    this.W = Math.max(2, Math.round(w));
    this.H = Math.max(2, Math.round(h));
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(this.W, this.H, false);
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(this.W, this.H);
    this.camera.left = 0;
    this.camera.right = this.W;
    this.camera.top = this.H;
    this.camera.bottom = 0;
    this.camera.updateProjectionMatrix();
    if (this.videoQuad) this.videoQuad.scale.set(this.W, this.H, 1);
  }

  setBloomEnabled(on: boolean): void {
    this.bloom.enabled = on;
  }

  addFlash(amount: number, color = 0xffffff): void {
    this.flashMat.color.setHex(color);
    this.flashMat.opacity = Math.min(1, this.flashMat.opacity + amount);
  }

  addShake(px: number): void {
    this.shake = Math.min(8, this.shake + px);
  }

  render(dt: number): void {
    this.flashMat.opacity = Math.max(0, this.flashMat.opacity - dt * 3);
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
