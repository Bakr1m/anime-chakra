# Decisions

| Date | Context | Choice | Why |
|---|---|---|---|
| 2026-10-10 | Already inside `anime-chakra/` (no parent scaffold needed) | `git init` in place | The working directory is the repo root. |
| 2026-10-10 | No Linux node, only Windows node.exe via WSL mount | Install Node 22.17.0 tarball to `~/.local/node` | No sudo needed, meets Node >= 20 requirement. |
| 2026-10-10 | Python 3.14 installed, AGENTS.md fixes 3.11 | Proceed with 3.11-compatible code on 3.14 | Fixed stack says 3.11; compatible subset runs on both. CI pins 3.11/3.12. |
| 2026-10-10 | No sudo, no make, missing system libs | User-local Node tarball, apt-downloaded debs + LD_LIBRARY_PATH, manual check sequence | No root needed; CI runners have all of these system-wide. |
| 2026-10-10 | Mirrored/photo decisions in renderer | y-down ortho frustum + DoubleSide quads; flash set-max; demo joint normalization | Screenshots proved each bug; alternatives (per-effect flips) scattered the fix. |
| 2026-10-10 | Models committed (28 MB) | Fetched via scripts/fetch-models.sh, sha256-verified | AGENTS.md requires committed models for offline Docker + Pages-adjacent use. |
| 2026-10-10 | Ensemble semantics | Rules always clear disagree-gate at 1.0; MLP guards the none-side | Geometric rules are high-precision; documented in docs/ML.md. |
| 2026-10-10 | iPhone e2e on Chromium | Stripped WebKit defaultBrowserType from the descriptor | AGENTS.md mandates Chromium for all projects. |
