# Contributing to Chakra Lens

## Setup

```sh
# web
cd web && npm ci && npm run dev
# python (venv recommended; mediapipe needs libGL/GLES around)
python3 -m venv .venv && .venv/bin/pip install -e "./python[dev]"
# models (one-time download, sha256-checked)
./scripts/fetch-models.sh
```

The web build copies `models/` into the app (`copy-models.mjs` pre-build
step) because hand tracking loads them from `/models/*` at runtime. A build
without them succeeds with a warning but ships dead tracking, and the
`models.spec.ts` e2e guard fails the build pipeline.

Local checks before every commit: `make check` (web lint+typecheck+unit,
python ruff+mypy+pytest), `make parity`, and `make e2e` if you touched
rendering. One logical step per commit, Conventional Commits
(`feat fix test ci docs build chore refactor perf`), imperative subject under
72 chars. No pushes to `main` outside the release flow; no secrets in history.

## How to add a new jutsu

1. **Spec first.** Add an entry to `spec/gestures.json` (id, character,
   hands, thresholds, cooldown, colors). If you need new math, document it in
   `spec/FEATURES.md` before coding it.
2. **Python brain.** Implement the rule in
   `python/src/chakralens/gestures/rules.py`, add positive/negative tests, and
   extend the fixture generator (`datasets/fixtures.py`) so `spec/fixtures/`
   covers the new sign.
3. **Web engine.** Port the rule to `web/src/gestures/rules.ts`; the parity
   suite (`make parity`) must stay green within 1e-4.
4. **Web visual.** Create `web/src/jutsu/<id>/` implementing the `Jutsu`
   interface (`src/jutsu/types.ts`), register it in `JutsuManager`, and support
   `?demo=<id>` via `src/demo/driver.ts`.
5. **Python visual.** Add the reduced-fidelity renderer under
   `python/src/chakralens/render/` plus headless metric tests.
6. **QA + docs.** Add the e2e hue/bloom/motion case, run the full matrix,
   commit the screenshot to `docs/img/`, and add a README table row.

Stretch (face/segmentation) jutsus additionally: extend the `requires` flags,
fuse in `JutsuManager`, and provide a demo fallback (forced label +
synthetic anchor) since CI has no camera.
