// HandLandmarker wrapper with GPU -> CPU fallback and a test seam.
// Model path is served locally (public/models) so the app works offline.
import type { Landmark } from '../gestures/features';

export interface DetectedHand {
  landmarks: Landmark[];
  handedness: 'Left' | 'Right';
}

export type Delegate = 'GPU' | 'CPU';

interface HandLandmarkerLike {
  detectForVideo(video: unknown, nowMs: number): { landmarks?: number[][][]; handedness?: { categoryName: string }[][] };
  close(): void;
}

export class HandTracker {
  private landmarker: HandLandmarkerLike | null = null;
  delegate: Delegate | null = null;
  onFallback: ((msg: string) => void) | null = null;

  get ready(): boolean {
    return this.landmarker !== null;
  }

  /** Lazily imports tasks-vision so unit tests never touch the network. */
  async init(modelPath = '/models/hand_landmarker.task'): Promise<Delegate> {
    const vision = await import('@mediapipe/tasks-vision');
    try {
      this.landmarker = await this.create(vision, modelPath, 'GPU');
      this.delegate = 'GPU';
    } catch {
      this.landmarker = await this.create(vision, modelPath, 'CPU');
      this.delegate = 'CPU';
      this.onFallback?.('GPU unavailable, using CPU. Effects still work but tracking may be slower.');
    }
    return this.delegate;
  }

  private async create(vision: unknown, modelPath: string, delegate: Delegate): Promise<HandLandmarkerLike> {
    const v = vision as {
      FilesetResolver: { forVisionTasks: (wasm: string) => Promise<unknown> };
      HandLandmarker: {
        createFromOptions: (fileset: unknown, o: unknown) => Promise<HandLandmarkerLike>;
      };
    };
    const fileset = await v.FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
    );
    return v.HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: modelPath, delegate },
      runningMode: 'VIDEO',
      numHands: 2,
    }) as Promise<HandLandmarkerLike>;
  }

  detect(video: HTMLVideoElement, nowMs: number): DetectedHand[] {
    if (!this.landmarker) return [];
    const res = this.landmarker.detectForVideo(video, nowMs);
    const out: DetectedHand[] = [];
    const lists = res.landmarks ?? [];
    for (let i = 0; i < lists.length; i++) {
      const pts = (lists[i] ?? []).map((p) => ({ x: p[0] ?? 0, y: p[1] ?? 0, z: p[2] ?? 0 }));
      const raw = res.handedness?.[i]?.[0]?.categoryName ?? 'Left';
      out.push({ landmarks: pts, handedness: raw === 'Right' ? 'Right' : 'Left' });
    }
    return out;
  }

  dispose(): void {
    this.landmarker?.close();
    this.landmarker = null;
  }
}
