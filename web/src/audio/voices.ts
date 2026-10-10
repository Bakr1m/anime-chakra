// Synthesized audio voices (no samples). Muted until a user gesture resumes
// the AudioContext. Master mute toggle persisted in localStorage.
export class SynthAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private nodes: AudioNode[] = [];
  muted = localStorage.getItem('chakra-muted') === '1';

  /** call from the start tap */
  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    }
    void this.ctx.resume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    localStorage.setItem('chakra-muted', m ? '1' : '0');
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.02);
    }
  }

  private noiseBuffer(seconds: number): AudioBuffer | null {
    if (!this.ctx) return null;
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * seconds), this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  private track(node: AudioNode): void {
    this.nodes.push(node);
  }

  /** Chidori: bandpass noise 2-6 kHz AM at ~30 Hz + thin chirp sweep */
  chidoriStart(): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(2);
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 4000;
    bp.Q.value = 0.8;
    const am = ctx.createOscillator();
    am.frequency.value = 30;
    const amGain = ctx.createGain();
    amGain.gain.value = 0.5;
    am.connect(amGain.gain);
    const g = ctx.createGain();
    g.gain.value = 0.35;
    src.connect(bp).connect(g);
    amGain.connect(g.gain);
    const chirp = ctx.createOscillator();
    chirp.type = 'sawtooth';
    chirp.frequency.setValueAtTime(1800, ctx.currentTime);
    chirp.frequency.exponentialRampToValueAtTime(3200, ctx.currentTime + 0.4);
    const cg = ctx.createGain();
    cg.gain.value = 0.03;
    chirp.connect(cg).connect(this.master);
    g.connect(this.master);
    src.start();
    am.start();
    chirp.start();
    for (const n of [src, am, chirp]) this.track(n);
    this.track(g);
  }

  /** Rasengan: low hum + airy shimmer */
  rasenganStart(): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 90;
    const g = ctx.createGain();
    g.gain.value = 0.12;
    osc.connect(g).connect(this.master);
    osc.start();
    this.track(osc);
    this.track(g);
  }

  rasenganStop(): void {
    this.stopTracked();
  }

  chidoriStop(): void {
    this.stopTracked();
  }

  /** Katon: filtered-noise rumble whoosh */
  katonBlast(): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(1.5);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(300, ctx.currentTime);
    lp.frequency.exponentialRampToValueAtTime(2500, ctx.currentTime + 0.25);
    lp.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 1.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.6, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.2);
    src.connect(lp).connect(g).connect(this.master);
    src.start();
  }

  /** Bunshin: short poof burst */
  poof(): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.4);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
    src.connect(bp).connect(g).connect(this.master);
    src.start();
  }

  private stopTracked(): void {
    for (const n of this.nodes) {
      try {
        (n as OscillatorNode).stop?.();
      } catch {
        /* already stopped */
      }
      n.disconnect();
    }
    this.nodes = [];
  }

  stopAll(): void {
    this.stopTracked();
  }
}
