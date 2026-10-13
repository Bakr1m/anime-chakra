// FaceLandmarker wrapper: mouth anchor for Katon, eye/iris for Sharingan.
// Runs every 3rd frame only when a jutsu needs it. Optional like segmentation.
import { modelUrl } from '../paths';
export interface FaceAnchor {
  mouthX: number;
  mouthY: number;
  headSize: number;
}

export interface EyeAnchor {
  /** eye center, normalized */
  cx: number;
  cy: number;
  /** eye width (outer-inner corner), normalized */
  width: number;
  /** iris center, normalized */
  ix: number;
  iy: number;
}

export class FaceTracker {
  private landmarker: {
    detectForVideo(v: unknown, t: number): { faceLandmarks?: { x: number; y: number }[][] };
    close(): void;
  } | null = null;
  private frame = 0;
  last: FaceAnchor | null = null;
  eyes: EyeAnchor[] = [];

  get ready(): boolean {
    return this.landmarker !== null;
  }

  async init(modelPath = modelUrl('face_landmarker.task')): Promise<void> {
    const vision = await import('@mediapipe/tasks-vision');
    const v = vision as unknown as {
      FilesetResolver: { forVisionTasks: (w: string) => Promise<unknown> };
      FaceLandmarker: { createFromOptions: (f: unknown, o: unknown) => Promise<never> };
    };
    const fileset = await v.FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
    );
    this.landmarker = (await v.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: modelPath, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numFaces: 1,
    })) as unknown as typeof this.landmarker;
  }

  /** call per frame; internally detects every 3rd frame. Normalized coords. */
  update(video: HTMLVideoElement, nowMs: number): void {
    if (!this.landmarker) return;
    this.frame++;
    if (this.frame % 3 !== 0) return;
    const res = this.landmarker.detectForVideo(video, nowMs);
    const face = res.faceLandmarks?.[0];
    if (!face) return;
    // lips: indices 13 (upper) / 14 (lower); head size from forehead(10)-chin(152)
    const upper = face[13];
    const lower = face[14];
    const fore = face[10];
    const chin = face[152];
    if (!upper || !lower || !fore || !chin) return;
    this.last = {
      mouthX: (upper.x + lower.x) / 2,
      mouthY: (upper.y + lower.y) / 2,
      headSize: Math.hypot(fore.x - chin.x, fore.y - chin.y),
    };
    // eyes: outer/inner corners + iris (MediaPipe indices)
    this.eyes = [];
    for (const [outer, inner, iris] of [
      [33, 133, 468],
      [263, 362, 473],
    ] as const) {
      const o = face[outer];
      const n = face[inner];
      const r = face[iris];
      if (!o || !n || !r) continue;
      this.eyes.push({
        cx: (o.x + n.x) / 2,
        cy: (o.y + n.y) / 2,
        width: Math.hypot(o.x - n.x, o.y - n.y),
        ix: r.x,
        iy: r.y,
      });
    }
  }

  dispose(): void {
    this.landmarker?.close();
    this.landmarker = null;
  }
}
