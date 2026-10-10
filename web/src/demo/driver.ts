// Demo driver: ?demo=<jutsu> runs the full pipeline headless with a synthetic
// hand (from committed fixtures) and a procedural background, so Playwright
// can assert hue/bloom/motion without a camera or model downloads.
import * as THREE from 'three';
import type { Landmark } from '../gestures/features';
import bunshinFx from '../../../spec/fixtures/bunshin.json';
import chidoriFx from '../../../spec/fixtures/chidori.json';
import katonFx from '../../../spec/fixtures/katon.json';
import rasenganFx from '../../../spec/fixtures/rasengan.json';

interface FixtureDoc {
  samples: { landmarks: Landmark[] }[];
}

const FIXTURES: Record<string, FixtureDoc> = {
  rasengan: rasenganFx as FixtureDoc,
  chidori: chidoriFx as FixtureDoc,
  katon: katonFx as FixtureDoc,
  bunshin: bunshinFx as FixtureDoc,
};

export function demoIds(): string[] {
  return Object.keys(FIXTURES);
}

/** remap synth units (~+/-220) into normalized video coords with a margin */
export function demoHands(id: string, time: number): Landmark[][] {
  const doc = FIXTURES[id];
  if (!doc) return [];
  // joint bounds over ALL hands: preserves relative wrist distance and
  // finger-line crossing for two-hand seals
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const s of doc.samples) {
    for (const p of s.landmarks) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
  }
  const bobY = Math.sin(time * 1.7) * 0.02;
  const swayX = Math.cos(time * 1.1) * 0.02;
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  const scale = 0.55 / Math.max(w / 300, h / 300, 1);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return doc.samples.map((s) =>
    s.landmarks.map((p) => ({
      x: 0.5 + ((p.x - cx) / 300) * scale + swayX,
      y: 0.42 + ((p.y - cy) / 300) * scale + bobY,
      // z scaled by the same factor: keeps 3D shape (extension ratios)
      z: ((p.z - 0) / 300) * scale,
    })),
  );
}

/** procedural background texture: dark dojo gradient with a glow spot */
export function demoBackground(): { texture: THREE.DataTexture; w: number; h: number } {
  const w = 640;
  const h = 360;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - w / 2) / w;
      const dy = (y - h * 0.45) / h;
      const d = Math.sqrt(dx * dx + dy * dy);
      const glow = Math.max(0, 1 - d * 1.8);
      // synthetic "person": soft head-and-shoulders capsule so mask/clone
      // paths have a subject even without a camera
      const hx = (x - w / 2) / (w * 0.09);
      const hyHead = (y - h * 0.42) / (h * 0.11);
      const hyBody = (y - h * 0.72) / (h * 0.3);
      const head = Math.max(0, 1 - (hx * hx + hyHead * hyHead));
      const shoulders = Math.max(0, 1 - (hx * hx * 0.35 + Math.max(0, hyBody) * Math.max(0, hyBody)));
      const person = Math.max(head * 0.9, shoulders * 0.55);
      const i = (y * w + x) * 4;
      // near-black neutral room + warm-gray person
      data[i] = Math.floor(8 + glow * 10 + person * 110);
      data[i + 1] = Math.floor(9 + glow * 9 + person * 100);
      data[i + 2] = Math.floor(12 + glow * 9 + person * 92);
      data[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, w, h);
  texture.flipY = true; // match VideoTexture orientation (frame top at v=1)
  texture.needsUpdate = true;
  return { texture, w, h };
}
