// Selfie segmentation pipeline (ImageSegmenter, selfie_multiclass_256x256).
// Runs every 2nd frame only when a jutsu needs it. Optional: null when the
// model is missing (demo mode, offline first-load) and jutsus degrade.
import * as THREE from 'three';
import { modelUrl } from '../paths';

export class Segmentation {
  private segmenter: {
    segmentForVideo(v: unknown, t: number, cb: (r: unknown) => void): void;
    close(): void;
  } | null = null;
  private maskTex: THREE.DataTexture | null = null;
  private frame = 0;
  maskWidth = 0;
  maskHeight = 0;
  status: 'idle' | 'loading' | 'ready' | 'error' = 'idle';

  get ready(): boolean {
    return this.segmenter !== null;
  }

  get mask(): THREE.DataTexture | null {
    return this.maskTex;
  }

  async init(modelPath = modelUrl('selfie_segmenter.tflite')): Promise<void> {
    this.status = 'loading';
    try {
      const vision = await import('@mediapipe/tasks-vision');
      const v = vision as unknown as {
        FilesetResolver: { forVisionTasks: (w: string) => Promise<unknown> };
        ImageSegmenter: { createFromOptions: (f: unknown, o: unknown) => Promise<never> };
      };
      const fileset = await v.FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
      );
      this.segmenter = (await v.ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: modelPath, delegate: 'GPU' },
        runningMode: 'VIDEO',
        outputCategoryMask: true,
      })) as unknown as typeof this.segmenter;
      this.status = 'ready';
    } catch (e) {
      this.status = 'error';
      throw e;
    }
  }

  /** call per frame; internally segments every 2nd frame */
  update(video: HTMLVideoElement, nowMs: number): void {
    if (!this.segmenter) return;
    this.frame++;
    if (this.frame % 2 !== 0) return;
    this.segmenter.segmentForVideo(video, nowMs, (res) => {
      const r = res as {
        categoryMask?: { width: number; height: number; getAsFloat32Array: () => Float32Array };
      };
      const mask = r.categoryMask;
      if (!mask) return;
      const w = mask.width;
      const h = mask.height;
      const src = mask.getAsFloat32Array();
      const data = new Uint8Array(w * h * 4);
      for (let i = 0; i < w * h; i++) {
        const person = (src[i] ?? 0) > 0.5 ? 255 : 0;
        data[i * 4] = person;
        data[i * 4 + 3] = 255;
      }
      if (!this.maskTex || this.maskWidth !== w || this.maskHeight !== h) {
        this.maskTex?.dispose();
        this.maskTex = new THREE.DataTexture(data, w, h);
        this.maskWidth = w;
        this.maskHeight = h;
      } else {
        this.maskTex.image.data.set(data);
        this.maskTex.needsUpdate = true;
      }
    });
  }

  dispose(): void {
    this.segmenter?.close();
    this.segmenter = null;
    this.maskTex?.dispose();
    this.maskTex = null;
  }
}
