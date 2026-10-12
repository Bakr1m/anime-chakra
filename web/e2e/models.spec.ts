import { expect, test } from '@playwright/test';

// The Pages deploy once shipped without /models/* (the Vite build never
// copied them) and hand tracking failed silently. This guards the built
// output directly: fast, no camera needed.
test('tracking models are served from the build', async ({ request }) => {
  for (const name of ['hand_landmarker.task', 'face_landmarker.task', 'selfie_segmenter.tflite']) {
    const res = await request.get(`/models/${name}`);
    expect(res.status(), name).toBe(200);
  }
});
