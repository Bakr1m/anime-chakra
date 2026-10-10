import { Camera } from './camera/camera';
import { SynthAudio } from './audio/voices';
import { demoBackground, demoHands } from './demo/driver';
import { LandmarkSmoother } from './filters/oneEuro';
import { classify } from './gestures/rules';
import { getSpec } from './gestures/spec';
import { JutsuState } from './gestures/stateMachine';
import { JutsuManager } from './jutsu/manager';
import { Clock } from './render/clock';
import { ParticlePool } from './render/particles';
import { OverlayRenderer } from './render/renderer';
import { QualityManager } from './render/quality';
import { DebugOverlay } from './ui/debugOverlay';
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

function makeHud(): { hud: HTMLElement; labelEl: HTMLElement | null } {
  if (!app) throw new Error('#app missing');
  const hud = document.createElement('div');
  hud.className = 'hud';
  hud.innerHTML = `<button type="button" class="flip">Flip camera</button>
    <button type="button" class="mute">Mute</button>
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

  const audio = new SynthAudio();
  const quality = new QualityManager();
  const particles = new ParticlePool(1024);
  renderer.fx.add(particles.points);
  const manager = new JutsuManager(renderer, particles, quality, audio);
  manager.setDemoSeed(id);
  const smoother = new LandmarkSmoother();
  const state = new JutsuState();
  const clock = new Clock();
  const overlay = new DebugOverlay(stage);
  overlay.resize(W, H);
  const spec = getSpec();

  let last = performance.now();
  const loop = (): void => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const time = clock.tick(dt);
    quality.update(dt * 1000, now);
    const hands = demoHands(id, time).map((h) => smoother.smooth(h, time));
    const [label, conf] = classify(hands, spec);
    const [active, charge] = state.update(label, conf, time, dt, spec);
    // demo mouth anchor for katon: above the hands
    const demoMouth =
      id === 'katon' && hands[0]?.[0]
        ? { x: W / 2, y: H * 0.2, headPx: 90 }
        : null;
    manager.update({ dt, time, hands, video: null, label, charge, activeId: active, demoMouth });
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

  const smoother = new LandmarkSmoother();
  renderer.fx.add(particles.points);
  const manager = new JutsuManager(renderer, particles, quality, audio);
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
    const smoothed = hands.map((h) => smoother.smooth(h.landmarks.map((p) => ({ ...p })), time));
    const [label, conf] = classify(smoothed, spec);
    const [active, charge] = state.update(label, conf, time, dt, spec);
    manager.update({ dt, time, hands: smoothed, video: hiddenVideo, label, charge, activeId: active });
    particles.update(dt);
    renderer.render(dt);
    if (labelEl) labelEl.textContent = active ?? label;
    overlay.draw(smoothed, active ?? label, charge, quality.fps);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
