# Performance: measured numbers, environments, and how to add yours

Every number below was measured, not estimated. Environments are stated
because a number without one is marketing.

## Python (`chakralens bench`, synthetic 640x480 loop)

Machine: Linux x86_64 container-ish WSL2 host, CPython 3.14, OpenCV 5.0
(headless), numpy. `bench` renders Rasengan + Chidori + two-scale Gaussian
bloom every frame (heavier than the live `run` path, which renders one jutsu).

| stage | ms/frame |
|---|---|
| features (`extract_hand`) | 0.06-0.14 |
| rules (`classify`) | 0.06-0.08 |
| render + bloom + encode | 75-91 |
| **total** | **~11-13 fps** |

The brain is free; the pixels cost. `cv2.GaussianBlur` at full frame
dominates. The documented >= 20 fps CPU target is **not met** by this
baseline. Paths: halve the bloom radius, render effects into an ROI instead
of fullscreen, or skip bloom every 2nd frame. The `quality` equivalent for
the desktop CLI is not implemented yet.

## Web gesture engine (node, not a browser)

`classifyEnsemble` (rules + MLP forward) over all committed fixtures x500:
**0.067 ms/decision**. Gesture math will never be the bottleneck.

## Web render (headless Chromium, SwiftShader software GL)

`?demo=rasengan`, desktop 1280x720 viewport, 60 rAF deltas:
**avg 63.8 ms, p95 62.9 ms (~15.7 fps)**.

Read this correctly: SwiftShader is a CPU rasterizer. This number proves the
pipeline runs end to end in CI; it says nothing about a real phone GPU, where
the same scene is one bloom pass plus a handful of quads. The desktop budget
(effect update+render <= 8 ms) is unverified until a real GPU reports it.

## How to add real numbers

1. Open the live demo with `?debug=1`, hold each sign 5 s.
2. Tap "Copy device report" (UA, resolution, delegate, avg/p95 frame time).
3. Paste it into `docs/DEVICE_TESTING.md` (real-device table) and link the run.

Until then, phone performance is "verified in Chromium mobile emulation;
real-device numbers not measured" — and the README says exactly that.
