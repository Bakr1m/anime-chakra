# Decisions

| Date | Context | Choice | Why |
|---|---|---|---|
| 2026-10-10 | Already inside `anime-chakra/` (no parent scaffold needed) | `git init` in place | The working directory is the repo root. |
| 2026-10-10 | No Linux node, only Windows node.exe via WSL mount | Install Node 22.17.0 tarball to `~/.local/node` | No sudo needed, meets Node >= 20 requirement. |
| 2026-10-10 | Python 3.14 installed, AGENTS.md fixes 3.11 | Proceed with 3.11-compatible code on 3.14 | Fixed stack says 3.11; compatible subset runs on both. CI pins 3.11/3.12. |
