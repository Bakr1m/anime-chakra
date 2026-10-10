// In-app sample recorder: key R or the HUD button captures 3 s of smoothed
// landmarks for a chosen label and downloads spec-compliant JSON.
export type RecorderState = 'idle' | 'recording' | 'done';

export interface RecordedSample {
  version: 1;
  label: string;
  source: 'web-recorder';
  capturedAt: string;
  frameIndex: number;
  landmarks: { handedness: string; points: { x: number; y: number; z: number }[] }[];
}

export const RECORDER_LABELS = [
  'rasengan',
  'chidori',
  'katon',
  'bunshin',
  'none',
  'other',
] as const;

export class SampleRecorder {
  state: RecorderState = 'idle';
  label: string = 'rasengan';
  private samples: RecordedSample[] = [];
  private frames = 0;
  private maxFrames = 90; // ~3 s at 30 fps
  onDone: ((samples: RecordedSample[]) => void) | null = null;

  start(label: string): void {
    this.label = label;
    this.samples = [];
    this.frames = 0;
    this.state = 'recording';
  }

  push(hands: { landmarks: { x: number; y: number; z: number }[]; handedness: string }[]): void {
    if (this.state !== 'recording' || hands.length === 0) return;
    this.samples.push({
      version: 1,
      label: this.label,
      source: 'web-recorder',
      capturedAt: new Date().toISOString(),
      frameIndex: this.frames,
      landmarks: hands.map((h) => ({ handedness: h.handedness, points: h.landmarks })),
    });
    this.frames++;
    if (this.frames >= this.maxFrames) {
      this.state = 'done';
      this.onDone?.(this.samples);
    }
  }

  download(): void {
    const blob = new Blob([this.samples.map((s) => JSON.stringify(s)).join('\n')], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chakra-${this.label}-${Date.now()}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
    this.state = 'idle';
  }
}
