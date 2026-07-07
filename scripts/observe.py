"""Phase 1 OBSERVE: capture completed Hermes sessions as task observations."""
from __future__ import annotations

from datetime import datetime, timezone

from lib import db
from lib.common import (
    DATA_DIR,
    ITERATIONS_DIR,
    MAX_SESSIONS_PER_RUN,
    RunLock,
    ensure_dirs,
    log,
    read_json,
    write_json,
)
from lib.hermes_reader import build_observation, completed_sessions_since
from lib.sanitize import scrub_obj

WATERMARK = DATA_DIR / "watermark.json"


def run() -> int:
    ensure_dirs()
    marker = read_json(WATERMARK, {"last_started_at": 0.0})
    sessions = completed_sessions_since(float(marker["last_started_at"]), MAX_SESSIONS_PER_RUN)
    if not sessions:
        log("observe: no new completed sessions")
        return 0

    db.set_loop_state("observing")
    captured = 0
    for session in sessions:
        obs = build_observation(session)
        obs, findings = scrub_obj(obs)
        if findings:
            log(f"observe: redacted {sorted(set(findings))} in {obs['task_id']}")

        ts_iso = datetime.fromtimestamp(obs["ts_epoch"], tz=timezone.utc).isoformat()
        db.insert(
            "loop_iterations",
            {
                "task_id": obs["task_id"],
                "source": obs["source"],
                "session_key": obs["session_key"],
                "ts": ts_iso,
                "user_request": obs["user_request"],
                "plan": obs["title"],
                "tools_used": obs["tools_used"],
                "output_summary": obs["output"],
                "mistakes": obs["mistakes"],
                "corrections": obs["corrections"],
                "token_usage": obs["token_usage"],
                "turn_count": obs["turn_count"],
                "duration_seconds": obs["duration_seconds"],
            },
            on_conflict="task_id",
        )
        write_json(ITERATIONS_DIR / f"{obs['task_id']}.json", obs)
        marker["last_started_at"] = max(float(marker["last_started_at"]), obs["ts_epoch"])
        write_json(WATERMARK, marker)
        captured += 1
        log(f"observe: captured {obs['task_id']} ({obs['title'][:60]!r})")

    db.set_loop_state("scoring", current_task_id=sessions[-1]["id"])
    log(f"observe: {captured} session(s) captured")
    return captured


if __name__ == "__main__":
    with RunLock("observe"):
        run()
