import { describe, expect, it } from 'vitest';
import { getSpec } from '../src/gestures/spec';
import { JutsuState } from '../src/gestures/stateMachine';

const spec = getSpec();

function activate(st: JutsuState, label = 'rasengan'): void {
  let now = 0;
  const dt = 1 / 30;
  for (let i = 0; i < spec.reliability.activateFrames; i++) {
    now += dt;
    st.update(label, 1.0, now, dt, spec);
  }
}

describe('JutsuState', () => {
  it('activates after N matching frames, not before', () => {
    const st = new JutsuState();
    let now = 0;
    const dt = 1 / 30;
    for (let i = 0; i < spec.reliability.activateFrames - 1; i++) {
      now += dt;
      expect(st.update('rasengan', 1.0, now, dt, spec)[0]).toBeNull();
    }
    now += dt;
    expect(st.update('rasengan', 1.0, now, dt, spec)[0]).toBe('rasengan');
  });

  it('ignores low confidence', () => {
    const st = new JutsuState();
    let now = 0;
    for (let i = 0; i < 20; i++) {
      now += 1 / 30;
      expect(st.update('rasengan', 0.5, now, 1 / 30, spec)[0]).toBeNull();
    }
  });

  it('releases after M misses and charges toward 1', () => {
    const st = new JutsuState();
    activate(st);
    let now = 10;
    for (let i = 0; i < spec.reliability.releaseFrames - 1; i++) {
      now += 1 / 30;
      expect(st.update('none', 0, now, 1 / 30, spec)[0]).toBe('rasengan');
    }
    now += 1 / 30;
    expect(st.update('none', 0, now, 1 / 30, spec)[0]).toBeNull();

    activate(st);
    now = 50;
    const charges: number[] = [];
    for (let i = 0; i < 120; i++) {
      now += 1 / 30;
      charges.push(st.update('rasengan', 1.0, now, 1 / 30, spec)[1]);
    }
    expect(charges[charges.length - 1] as number).toBeGreaterThan(0.99);
  });

  it('cooldown blocks immediate retrigger', () => {
    const st = new JutsuState();
    activate(st, 'katon');
    let now = 5;
    for (let i = 0; i < spec.reliability.releaseFrames; i++) {
      now += 1 / 30;
      st.update('none', 0, now, 1 / 30, spec);
    }
    expect(st.activeId).toBeNull();
    for (let i = 0; i < spec.reliability.activateFrames; i++) {
      now += 1 / 30;
      expect(st.update('katon', 1.0, now, 1 / 30, spec)[0]).toBeNull();
    }
  });
});
