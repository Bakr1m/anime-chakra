# Capturing real phone numbers

Emulation proves the pipeline runs. Only a physical phone proves it is fast.
This page is the procedure; paste results into the table at the bottom and
link it from the README performance section.

## Procedure (2 minutes)

1. Open the live demo on your phone (Pages URL or `make phone` tunnel URL).
2. Add `?debug=1` to the URL.
3. Hold each sign steady for 5 seconds: Rasengan, Chidori, Katon, Bunshin.
4. Tap **Copy device report**. It contains:
   `userAgent, viewport, video resolution, delegate (GPU/CPU), devicePixelRatio,
   avg/p95 frame time, quality level`.
5. Paste the JSON into the table below (trim the UA to model + OS).

## What good looks like

- avg frame <= 33 ms at 640x480 (24 fps budget), delegate GPU.
- `quality: 0`. If you see 1 or 2, the adaptive scaler kicked in: say so,
  it means the phone could not hold 24 fps at full quality.
- Note the browser (Safari vs Chrome), the room light, and whether the phone
  was warm. One line of context beats a bare number.

## Real-device table

| Date | Phone / OS / browser | Resolution | Delegate | Avg / p95 (ms) | Quality | Notes |
|---|---|---|---|---|---|---|
| - | - | - | - | - | - | No real-device runs yet. Everything below is emulation or desktop. |

## Non-phone numbers already measured

- `docs/PERF.md`: Python bench, node gesture-engine timing, SwiftShader CI run.
- `docs/img/confusion.txt`: synthetic MLP baseline.
