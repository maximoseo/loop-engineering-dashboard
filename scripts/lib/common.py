"""Shared config, paths, logging, env loading, and run locking."""
from __future__ import annotations

import json
import os
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = SCRIPTS_DIR.parent
DATA_DIR = REPO_ROOT / "data"
ITERATIONS_DIR = DATA_DIR / "iterations"
ROLLBACK_DIR = DATA_DIR / "rollback"
LOGS_DIR = DATA_DIR / "logs"

HERMES_HOME = Path(os.environ.get("LOCALAPPDATA", "")) / "hermes"
HERMES_STATE_DB = HERMES_HOME / "state.db"
HERMES_CLI = Path(os.environ.get("USERPROFILE", "")) / ".local" / "bin" / "hermes.ps1"
MANAGED_SKILLS_DIR = HERMES_HOME / "skills" / "loop-managed"

SUPABASE_PROJECT_REF = "wtpczvyupmavzrxisvcm"
SUPABASE_URL = f"https://{SUPABASE_PROJECT_REF}.supabase.co"

# Bounded loops: hard caps per scheduled run
MAX_SESSIONS_PER_RUN = 5
MAX_SCORES_PER_RUN = 5
MAX_LESSON_TASKS_PER_RUN = 5
MAX_PROPOSALS_PER_RUN = 2
JUDGE_TIMEOUT_S = 420


def _load_env_file() -> None:
    env_path = SCRIPTS_DIR / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


_load_env_file()


def ensure_dirs() -> None:
    for d in (DATA_DIR, ITERATIONS_DIR, ROLLBACK_DIR, LOGS_DIR):
        d.mkdir(parents=True, exist_ok=True)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


def log(msg: str) -> None:
    ensure_dirs()
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{stamp}Z] {msg}"
    print(line)
    logfile = LOGS_DIR / f"loop-{datetime.now(timezone.utc):%Y%m%d}.log"
    with logfile.open("a", encoding="utf-8") as fh:
        fh.write(line + "\n")


def read_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


class RunLock:
    """Prevents overlapping scheduled runs of the same phase."""

    def __init__(self, name: str, stale_after_s: int = 3600) -> None:
        ensure_dirs()
        self.path = DATA_DIR / f".lock-{name}"
        self.stale_after_s = stale_after_s

    def __enter__(self) -> "RunLock":
        if self.path.exists():
            age = time.time() - self.path.stat().st_mtime
            if age < self.stale_after_s:
                log(f"lock {self.path.name} held ({age:.0f}s old); exiting")
                sys.exit(0)
            log(f"stale lock {self.path.name} ({age:.0f}s); reclaiming")
        self.path.write_text(str(os.getpid()), encoding="utf-8")
        return self

    def __exit__(self, *exc) -> None:
        try:
            self.path.unlink()
        except OSError:
            pass
