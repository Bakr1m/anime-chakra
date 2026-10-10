// Camera module: front/back flip, iOS quirks, resolution negotiation.
// The camera only starts after an explicit user tap (see ui/startScreen.ts).

export type Facing = 'user' | 'environment';

export interface CameraOptions {
  facing: Facing;
  /** preferred width; mobile defaults to 640, desktop to 1280 */
  width: number;
}

export function defaultWidth(): number {
  if (typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) {
    return 640;
  }
  return 1280;
}

export class Camera {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  facing: Facing = 'user';

  async start(video: HTMLVideoElement, opts?: Partial<CameraOptions>): Promise<void> {
    this.stop();
    this.video = video;
    this.facing = opts?.facing ?? this.facing;
    const width = opts?.width ?? defaultWidth();
    // iOS Safari: playsinline + muted + an in-gesture play() call are required.
    video.playsInline = true;
    video.muted = true;
    video.setAttribute('playsinline', 'true');
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: this.facing,
        width: { ideal: width },
        frameRate: { ideal: 30 },
      },
      audio: false,
    });
    video.srcObject = this.stream;
    await video.play();
    await new Promise<void>((resolve) => {
      if (video.readyState >= 2) return resolve();
      video.onloadeddata = () => resolve();
    });
  }

  async flip(): Promise<void> {
    if (!this.video) return;
    const next: Facing = this.facing === 'user' ? 'environment' : 'user';
    await this.start(this.video, { facing: next });
  }

  stop(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video) this.video.srcObject = null;
  }

  size(): [number, number] {
    if (!this.video) return [0, 0];
    return [this.video.videoWidth, this.video.videoHeight];
  }
}
