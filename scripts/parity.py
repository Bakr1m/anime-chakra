#!/usr/bin/env python3
"""Cross-language parity gate: python fixtures suite + web parity suite.

Fails (exit 1) on any drift. CI runs this as the `parity` job.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run(cmd: list[str], cwd: Path) -> int:
    env = dict(os.environ)
    env["PATH"] = str(ROOT / ".venv" / "bin") + os.pathsep + env.get("PATH", "")
    home = os.environ.get("HOME", "")
    node_bin = Path(home) / ".local" / "node" / "bin"
    if node_bin.exists():
        env["PATH"] = str(node_bin) + os.pathsep + env["PATH"]
    print(f"$ {' '.join(cmd)} (in {cwd})", flush=True)
    proc = subprocess.run(cmd, cwd=cwd, env=env, check=False)  # return code handled by caller
    return proc.returncode


def main() -> int:
    failures = 0
    venv_py = ROOT / ".venv" / "bin" / "python"
    py = str(venv_py) if venv_py.exists() else sys.executable
    failures += run([py, "-m", "pytest", "python/tests/test_fixtures.py", "-q"], ROOT)
    failures += run(
        ["npx", "vitest", "run", "tests/parity.test.ts", "--config", "vitest.config.ts"],
        ROOT / "web",
    )
    if failures:
        print("PARITY FAILED: web and python disagree. See above.", flush=True)
        return 1
    print("PARITY OK: 7 fixtures agree on labels and features.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
