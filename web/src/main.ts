import { Camera } from './camera/camera';
import { LandmarkSmoother } from './filters/oneEuro';
import { classify } from './gestures/rules';
import { getSpec } from './gestures/spec';
import { JutsuState } from './gestures/stateMachine';
import { renderStartScreen, setStatus } from './ui/startScreen';
import { DebugOverlay } from './ui/debugOverlay';
import './style.css';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('#app missing');

renderStartScreen(app, () => void onStart());

async function onStart(): Promise<void> {
  if (!app) return;
  setStatus(app, 'starting', 'Starting camera…');
  const camera = new Camera();
  const stage = document.createElement('div');
  stage.className = 'stage';
  const video = document.createElement('video');
  video.muted = true;
  stage.appendChild(video);
  app.innerHTML = '';
  app.appendChild(stage);

  const hud = document.createElement('div');
  hud.className = 'hud';
  hud.innerHTML = `<button type="button" class="flip">Flip camera</button><span class="label"></span>`;
  app.appendChild(hud);
  const labelEl = hud.querySelector<HTMLElement>('.label');

  try {
    await camera.start(video);
  } catch (err) {
    renderStartScreen(app, () => void onStart());
    setStatus(app, 'error', err instanceof Error ? err.message : String(err));
    return;
  }

  hud.querySelector<HTMLButtonElement>('.flip')?.addEventListener('click', () => {
    void camera.flip().catch(() => undefined);
  });

  // Vision stack loads lazily; debug skeleton works even before models arrive.
  const { HandTracker } = await import('./vision/hands');
  const tracker = new HandTracker();
  const smoother = new LandmarkSmoother();
  const state = new JutsuState();
  const overlay = new DebugOverlay(stage);
  const spec = getSpec();
  let last = performance.now();
  let fps = 60;

  tracker.onFallback = (msg) => {
    if (labelEl) labelEl.textContent = msg;
  };
  await tracker.init().catch(() => null);

  const onResize = (): void => {
    const [w, h] = camera.size();
    overlay.resize(w || video.clientWidth, h || video.clientHeight);
  };
  window.addEventListener('orientationchange', onResize);
  window.addEventListener('resize', onResize);
  onResize();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) video.pause();
    else void video.play().catch(() => undefined);
  });

  const loop = (): void => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    fps += (1 / Math.max(dt, 1e-3) - fps) * 0.05;
    const hands = tracker.ready ? tracker.detect(video, now) : [];
    const smoothed = hands.map((h) => smoother.smooth(h.landmarks.map((p) => ({ ...p })), now / 1000));
    const [label, conf] = classify(smoothed, spec);
    const [active, charge] = state.update(label, conf, now / 1000, dt, spec);
    if (labelEl && !tracker.onFallback) labelEl.textContent = '';
    if (labelEl && labelEl.textContent === '') labelEl.textContent = active ?? label;
    overlay.draw(smoothed, active ?? label, charge, fps);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
