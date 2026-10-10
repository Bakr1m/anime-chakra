import { Camera } from './camera/camera';
import { SynthAudio } from './audio/voices';
import { demoBackground, demoEyeSpot, demoHands, demoMask } from './demo/driver';
import { LandmarkSmoother } from './filters/oneEuro';
import { classifyEnsemble } from './gestures/ensemble';
import { getSpec } from './gestures/spec';
import { JutsuState } from './gestures/stateMachine';
import { JutsuManager } from './jutsu/manager';
import { Clock } from './render/clock';
import { ParticlePool } from './render/particles';
import { OverlayRenderer } from './render/renderer';
import { QualityManager } from './render/quality';
import { DebugOverlay } from './ui/debugOverlay';
import { RECORDER_LABELS, SampleRecorder } from './ui/recorder';
import { renderStartScreen, setStatus } from './ui/startScreen';
import './style.css';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('#app missing');

const params = new URLSearchParams(location.search);
const demoId = params.get('demo');

if (demoId) {
  void runDemo(demoId);
} else {
  renderStartScreen(app, () => {
    void onStart();
  });
}

function makeStage(): { stage: HTMLElement; canvas: HTMLCanvasElement } {
  if (!app) throw new Error('#app missing');
  app.innerHTML = '';
  const stage = document.createElement('div');
  stage.className = 'stage';
  const canvas = document.createElement('canvas');
  stage.appendChild(canvas);
  app.appendChild(stage);
  return { stage, canvas };
}

function rgbToHue(r: number, g: number, b: number): number {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  if (mx === mn) return -1;
  const d = mx - mn;
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return h;
}

/** test seam for visual QA: hue/luminance stats + frame-to-frame motion */
function exposeStats(canvas: HTMLCanvasElement, w: number, h: number): void {
  const probe = document.createElement('canvas');
  probe.width = w;
  probe.height = h;
  const pctx = probe.getContext('2d', { willReadFrequently: true });
  let prev: Uint8ClampedArray | null = null;
  (window as unknown as Record<string, unknown>)['__chakraStats'] = () => {
    if (!pctx) return null;
    pctx.drawImage(canvas, 0, 0, w, h);
    const data = pctx.getImageData(0, 0, w, h).data;
    // effect ROI: center box (demo anchors the hand near center)
    const x0 = Math.floor(w * 0.2);
    const x1 = Math.floor(w * 0.8);
    const y0 = Math.floor(h * 0.15);
    const y1 = Math.floor(h * 0.85);
    const hues: number[] = [];
    let peak = 0;
    let bright = 0;
    let n = 0;
    let motion = 0;
    let compared = 0;
    for (let y = y0; y < y1; y += 2) {
      for (let x = x0; x < x1; x += 2) {
        const i = (y * w + x) * 4;
        const r = (data[i] ?? 0) / 255;
        const g = (data[i + 1] ?? 0) / 255;
        const b = (data[i + 2] ?? 0) / 255;
        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        peak = Math.max(peak, luma);
        if (luma > 0.45) {
          bright++;
          const hue = rgbToHue(r, g, b);
          if (hue >= 0) hues.push(hue);
        }
        n++;
        if (prev) {
          motion +=
            Math.abs((data[i] ?? 0) - (prev[i] ?? 0)) +
            Math.abs((data[i + 1] ?? 0) - (prev[i + 1] ?? 0)) +
            Math.abs((data[i + 2] ?? 0) - (prev[i + 2] ?? 0));
          compared++;
        }
      }
    }
    hues.sort((a, b) => a - b);
    const medianHue = hues.length ? (hues[Math.floor(hues.length / 2)] ?? -1) : -1;
    prev = new Uint8ClampedArray(data);
    return {
      medianHue,
      peakLuma: peak,
      brightFrac: n ? bright / n : 0,
      motion: compared ? motion / compared / 255 : 0,
    };
  };
}

function makeHud(): { hud: HTMLElement; labelEl: HTMLElement | null } {
  if (!app) throw new Error('#app missing');
  const hud = document.createElement('div');
  hud.className = 'hud';
  hud.innerHTML = `<button type="button" class="flip">Flip camera</button>
    <button type="button" class="mute">Mute</button>
    <select class="reclabel" aria-label="Record label">
      <option>rasengan</option><option>chidori</option><option>katon</option>
      <option>bunshin</option><option>none</option><option>other</option>
    </select>
    <button type="button" class="rec">Record</button>
    <span class="label"></span>`;
  app.appendChild(hud);
  return { hud, labelEl: hud.querySelector<HTMLElement>('.label') };
}

async function runDemo(id: string): Promise<void> {
  if (!app) return;
  const { stage, canvas } = makeStage();
  const renderer = new OverlayRenderer(canvas);
  const W = 640;
  const H = 360;
  renderer.resize(W, H, 1);
  const bg = demoBackground();
  renderer.attachTexture(bg.texture, bg.w, bg.h);
  const mask = id === 'kurama' ? demoMask() : null;
  const forceId = id === 'sharingan' || id === 'kurama' ? id : null;

  const audio = new SynthAudio();
  const quality = new QualityManager();
  const particles = new ParticlePool(1024);
  particles.setPixelRatio(1);
  renderer.fx.add(particles.points);
  const manager = new JutsuManager(renderer, particles, quality, audio);
  manager.setDemoSeed(id);
  const smoothers: LandmarkSmoother[] = [];
  const smoothHands = (hands: { x: number; y: number; z: number }[][], t: number) =>
    hands.map((h, i) => {
      smoothers[i] ??= new LandmarkSmoother();
      return (smoothers[i] as LandmarkSmoother).smooth(h, t);
    });
  const state = new JutsuState();
  const clock = new Clock();
  const overlay = new DebugOverlay(stage);
  overlay.resize(W, H);
  const spec = getSpec();

  let last = performance.now();
  exposeStats(canvas, W, H);
  const loop = (): void => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const time = clock.tick(dt);
    quality.update(dt * 1000, now);
    const hands = smoothHands(demoHands(id, time), time);
    const [label, conf] = classifyEnsemble(hands, spec);
    const [active, charge] = state.update(label, conf, time, dt, spec);
    // demo mouth anchor for katon: above the hands
    const demoMouth =
      id === 'katon' && hands[0]?.[0]
        ? { x: W / 2, y: H * 0.32, headPx: 90 }
        : null;
    manager.update({
      dt,
      time,
      hands,
      video: null,
      label,
      charge,
      activeId: active,
      demoMouth,
      forceId,
      demoEye: id === 'sharingan' ? demoEyeSpot() : null,
      demoMask: mask ? mask.texture : null,
    });
    const w = window as unknown as Record<string, unknown>;
    w['__chakraLabel'] = active ?? label;
    const hist = (w['__chakraHist'] as string[] | undefined) ?? [];
    hist.push(label);
    if (hist.length > 40) hist.shift();
    w['__chakraHist'] = hist;
    particles.update(dt);
    renderer.render(dt);
    overlay.draw(hands, active ?? label, charge, 60);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

async function onStart(): Promise<void> {
  if (!app) return;
  setStatus(app, 'starting', 'Starting camera…');
  const audio = new SynthAudio();
  audio.unlock();
  const camera = new Camera();
  const hiddenVideo = document.createElement('video');
  hiddenVideo.muted = true;
  hiddenVideo.style.display = 'none';
  document.body.appendChild(hiddenVideo);
  try {
    await camera.start(hiddenVideo);
  } catch (err) {
    renderStartScreen(app, () => {
      void onStart();
    });
    setStatus(app, 'error', err instanceof Error ? err.message : String(err));
    return;
  }

  const { stage, canvas } = makeStage();
  const { hud, labelEl } = makeHud();
  const renderer = new OverlayRenderer(canvas);
  renderer.attachVideo(hiddenVideo);
  const quality = new QualityManager();
  const particles = new ParticlePool(1024);

  hud.querySelector<HTMLButtonElement>('.flip')?.addEventListener('click', () => {
    void camera.flip().catch(() => undefined);
  });
  const muteBtn = hud.querySelector<HTMLButtonElement>('.mute');
  const paintMute = (): void => {
    if (muteBtn) muteBtn.textContent = audio.muted ? 'Unmute' : 'Mute';
  };
  muteBtn?.addEventListener('click', () => {
    audio.setMuted(!audio.muted);
    paintMute();
  });
  paintMute();

  const recorder = new SampleRecorder();
  const recLabel = hud.querySelector<HTMLSelectElement>('.reclabel');
  const recBtn = hud.querySelector<HTMLButtonElement>('.rec');
  const paintRec = (): void => {
    if (recBtn) {
      recBtn.textContent = recorder.state === 'recording' ? 'Stop' : 'Record';
    }
  };
  const toggleRec = (): void => {
    if (recorder.state === 'recording') {
      recorder.download();
    } else {
      recorder.start(recLabel?.value && RECORDER_LABELS.includes(recLabel.value as 'rasengan') ? recLabel.value : 'rasengan');
    }
    paintRec();
  };
  recBtn?.addEventListener('click', toggleRec);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') toggleRec();
  });
  recorder.onDone = () => {
    recorder.download();
    paintRec();
  };

  if (new URLSearchParams(location.search).has('debug')) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Copy device report';
    btn.addEventListener('click', () => {
      void quality.copyReport(camera.size()).then(() => {
        btn.textContent = 'Copied!';
      });
    });
    hud.appendChild(btn);
  }

  const { HandTracker } = await import('./vision/hands');
  const tracker = new HandTracker();
  tracker.onFallback = (msg) => {
    if (labelEl) labelEl.textContent = msg;
  };
  await tracker.init().catch(() => null);
  quality.delegate = tracker.delegate ?? 'unavailable';

  const liveSmoothers: LandmarkSmoother[] = [];
  renderer.fx.add(particles.points);
  const manager = new JutsuManager(renderer, particles, quality, audio);
  particles.setPixelRatio(quality.pixelRatio);
  const state = new JutsuState();
  const overlay = new DebugOverlay(stage);
  const spec = getSpec();
  let last = performance.now();

  const fit = (): void => {
    const rect = stage.getBoundingClientRect();
    const w = Math.max(2, Math.round(rect.width));
    const h = Math.max(2, Math.round(rect.height));
    renderer.resize(w, h, quality.pixelRatio);
    overlay.resize(w, h);
    const [vw, vh] = camera.size();
    if (vw && vh) renderer.layoutVideo(vw, vh);
  };
  window.addEventListener('orientationchange', fit);
  window.addEventListener('resize', fit);
  fit();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenVideo.pause();
      audio.stopAll();
    } else {
      void hiddenVideo.play().catch(() => undefined);
    }
  });

  const loop = (): void => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const time = now / 1000;
    quality.update(dt * 1000, now);
    renderer.setBloomEnabled(quality.bloomEnabled);
    if (quality.level > 0) fit();
    const hands = tracker.ready ? tracker.detect(hiddenVideo, now) : [];
    const smoothed = hands.map((h, i) => {
      liveSmoothers[i] ??= new LandmarkSmoother();
      return (liveSmoothers[i] as LandmarkSmoother).smooth(
        h.landmarks.map((p) => ({ ...p })),
        time,
      );
    });
    const [label, conf] = classifyEnsemble(smoothed, spec);
    const [active, charge] = state.update(label, conf, time, dt, spec);
    manager.update({ dt, time, hands: smoothed, video: hiddenVideo, label, charge, activeId: active });
    recorder.push(
      hands.map((h, i) => ({
        landmarks: smoothed[i] ?? [],
        handedness: h.handedness,
      })),
    );
    particles.update(dt);
    renderer.render(dt);
    if (labelEl) labelEl.textContent = active ?? label;
    overlay.draw(smoothed, active ?? label, charge, quality.fps);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
