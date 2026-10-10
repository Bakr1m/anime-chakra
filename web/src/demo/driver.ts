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
  return doc.samples.map((s) => {
    const pts = s.landmarks.map((p) => ({ ...p }));
    // bounds
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    const bobY = Math.sin(time * 1.7) * 0.02;
    const swayX = Math.cos(time * 1.1) * 0.02;
    const w = maxX - minX || 1;
    const h = maxY - minY || 1;
    const scale = 0.55 / Math.max(w / 300, h / 300, 1);
    return pts.map((p) => ({
      x: 0.5 + ((p.x - (minX + maxX) / 2) / 300) * scale + swayX,
      y: 0.45 + ((p.y - (minY + maxY) / 2) / 300) * scale + bobY,
      z: p.z / 300,
    }));
  });
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
      const i = (y * w + x) * 4;
      data[i] = Math.floor(18 + glow * 40);
      data[i + 1] = Math.floor(20 + glow * 34);
      data[i + 2] = Math.floor(30 + glow * 44);
      data[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, w, h);
  texture.needsUpdate = true;
  return { texture, w, h };
}
