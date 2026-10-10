// Start screen: permission flow, privacy notice. Camera starts only on tap.
export type StartState = 'idle' | 'starting' | 'running' | 'error';

export function renderStartScreen(root: HTMLElement, onStart: () => void): void {
  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'start-screen';
  wrap.innerHTML = `
    <h1>Chakra Lens</h1>
    <p class="pitch">Make a hand sign. Get the jutsu.</p>
    <div class="privacy">Everything runs on your device. No video ever leaves your phone.</div>
    <div class="privacy">Contains flashing light effects. Enable Reduce motion in your system settings to calm them.</div>
    <button class="start-btn" type="button">Start camera</button>
    <div class="status" role="status"></div>`;
  const btn = wrap.querySelector<HTMLButtonElement>('.start-btn');
  btn?.addEventListener('click', onStart);
  root.appendChild(wrap);
}

export function setStatus(root: HTMLElement, state: StartState, message = ''): void {
  const el = root.querySelector<HTMLElement>('.status');
  if (el) el.textContent = state === 'error' ? `Camera error: ${message}` : message;
  const btn = root.querySelector<HTMLButtonElement>('.start-btn');
  if (btn) btn.disabled = state === 'starting';
}
