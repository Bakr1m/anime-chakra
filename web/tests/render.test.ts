import { describe, expect, it } from 'vitest';
import { hashSeed, mulberry32 } from '../src/render/clock';
import { ParticlePool } from '../src/render/particles';
import { QualityManager } from '../src/render/quality';

describe('seeded RNG', () => {
  it('mulberry32 is deterministic', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 50; i++) expect(a()).toBe(b());
  });

  it('different seeds differ, hashSeed is stable', () => {
    expect(hashSeed('rasengan')).toBe(hashSeed('rasengan'));
    expect(hashSeed('rasengan')).not.toBe(hashSeed('chidori'));
    const a = mulberry32(1)();
    const b = mulberry32(2)();
    expect(a).not.toBe(b);
  });
});

describe('ParticlePool', () => {
  it('spawns, ages and removes', () => {
    const pool = new ParticlePool(16);
    pool.spawn({ x: 0, y: 0, vx: 10, vy: 0, life: 0.1, size: 4, r: 1, g: 1, b: 1 });
    expect(pool.alive).toBe(1);
    pool.update(0.05);
    expect(pool.alive).toBe(1);
    pool.update(0.1);
    expect(pool.alive).toBe(0);
    pool.dispose();
  });

  it('caps at max', () => {
    const pool = new ParticlePool(4);
    for (let i = 0; i < 10; i++) {
      pool.spawn({ x: 0, y: 0, vx: 0, vy: 0, life: 1, size: 1, r: 1, g: 1, b: 1 });
    }
    expect(pool.alive).toBe(4);
    pool.dispose();
  });
});

describe('reduced motion', () => {
  it('pins particle scale low', () => {
    const q = new QualityManager();
    q.reducedMotion = true;
    expect(q.particleScale).toBe(0.25);
  });
});

describe('QualityManager', () => {
  it('degrades after sustained low fps and reports', () => {
    const q = new QualityManager();
    for (let t = 0; t < 3000; t += 100) q.update(100, t);
    expect(q.level).toBeGreaterThan(0);
    const rep = q.report([640, 480]);
    expect(rep.video).toEqual([640, 480]);
    expect(rep.p95Ms).toBeGreaterThanOrEqual(rep.avgMs);
  });
});
