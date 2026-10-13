import { describe, expect, it } from 'vitest';
import { modelUrl, withBase } from '../src/paths';

describe('base-aware paths', () => {
  it('prefixes the Vite base without doubling slashes', () => {
    // under vitest BASE_URL is '/', matching local dev
    expect(withBase('models/a.task')).toBe('/models/a.task');
    expect(withBase('/models/a.task')).toBe('/models/a.task');
    expect(modelUrl('hand_landmarker.task')).toBe('/models/hand_landmarker.task');
  });
});
