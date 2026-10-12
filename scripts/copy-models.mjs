// Pre-build: copy the committed MediaPipe models into the web build.
// Without this the deployed app has no /models/* and hand tracking fails
// silently (this exact outage happened on Pages). Warns loudly but does not
// fail, so model-less local dev iterations still build.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'models');
const dest = join(root, 'web', 'public', 'models');

const wanted = ['hand_landmarker.task', 'face_landmarker.task', 'selfie_segmenter.tflite'];
if (!existsSync(src)) {
  console.warn('[copy-models] WARNING: models/ missing - run scripts/fetch-models.sh. Build continues without tracking models.');
  process.exit(0);
}
mkdirSync(dest, { recursive: true });
let copied = 0;
for (const name of wanted) {
  const from = join(src, name);
  if (!existsSync(from)) {
    console.warn(`[copy-models] WARNING: ${name} missing - tracking that needs it will fail at runtime.`);
    continue;
  }
  copyFileSync(from, join(dest, name));
  copied++;
}
// keep any other committed extras (checksums file, future models)
for (const name of readdirSync(src)) {
  if (wanted.includes(name)) continue;
  const from = join(src, name);
  try {
    copyFileSync(from, join(dest, name));
  } catch {
    // directories and friends: skip
  }
}
console.log(`[copy-models] ${copied}/${wanted.length} tracking models staged into web/public/models`);
