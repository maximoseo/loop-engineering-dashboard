"""Local control CLI for the loop engine (replaces any public control endpoint).

Usage:
  python loopctl.py status
  python loopctl.py run micro        # observe -> score -> lessons
  python loopctl.py run improve      # propose -> test -> activate + monitor
  python loopctl.py run baseline     # refresh regression eval baseline
  python loopctl.py run cycle        # micro + improve
  python loopctl.py approve <proposal_id>
  python loopctl.py rollback <proposal_id> [reason]
  python loopctl.py health           # daily heartbeat + failure scan
"""
from __future__ import annotations

import json
import sys

from lib import db
from lib.common import DATA_DIR, log, read_json


def cmd_status() -> None:
    state = db.select("loop_state", "id=eq.main")
    iterations = db.run_sql("select count(*) as n from public.loop_iterations;")
    scores = db.run_sql(
        "select round(avg(total)) as avg7 from public.loop_scores where created_at > now() - interval '7 days';"
    )
    pending = db.run_sql(
        "select proposal_id, type, target, risk_level from public.loop_proposals where status = 'pending_approval';"
    )
    print(json.dumps(
        {
            "state": state[0] if state else None,
            "total_iterations": iterations[0]["n"] if iterations else 0,
            "avg_score_7d": scores[0]["avg7"] if scores else None,
            "pending_approval": pending,
            "watermark": read_json(DATA_DIR / "watermark.json", {}),
        },
        indent=2,
        default=str,
        ensure_ascii=False,
    ))


def cmd_run(phase: str) -> None:
    from lib.common import RunLock

    if phase in ("micro", "cycle"):
        import observe, score, extract_lessons  # noqa: E401

        with RunLock("micro", stale_after_s=5400):
            observe.run()
            score.run()
            extract_lessons.run()
    if phase in ("improve", "cycle"):
        import propose
        import activate_or_rollback as act

        with RunLock("improve", stale_after_s=7200):
            propose.run()
            act.process_proposed()
            act.monitor()
    if phase == "baseline":
        import run_evals

        with RunLock("evals", stale_after_s=7200):
            run_evals.run_baseline_refresh()


def cmd_approve(proposal_id: str) -> None:
    import activate_or_rollback as act

    rows = db.select("loop_proposals", f"proposal_id=eq.{proposal_id}")
    if not rows:
        print(f"proposal {proposal_id} not found")
        sys.exit(1)
    proposal = rows[0]
    if proposal["status"] != "pending_approval":
        print(f"proposal is '{proposal['status']}', expected pending_approval")
        sys.exit(1)
    if not act.is_whitelisted(proposal["target"]):
        print("Target is outside the managed whitelist. Apply manually, then mark active:")
        print(f"  target: {proposal['target']}")
        print(f"  content:\n{proposal['new_value']}")
        answer = input("Mark as active (applied manually)? [y/N] ").strip().lower()
        if answer == "y":
            db.update("loop_proposals", f"proposal_id=eq.{proposal_id}", {"status": "active"})
            db.insert("loop_activations", {"proposal_id": proposal_id, "action": "approved", "reason": "manual apply confirmed"})
        return
    act.activate(proposal, dict(proposal.get("eval_summary") or {}), "human approved via loopctl")
    db.insert("loop_activations", {"proposal_id": proposal_id, "action": "approved", "reason": "loopctl approve"})


def cmd_rollback(proposal_id: str, reason: str) -> None:
    import activate_or_rollback as act

    if not act.rollback(proposal_id, reason):
        sys.exit(1)


def cmd_health() -> None:
    recurring = db.run_sql(
        "select pattern_key, frequency from public.loop_failure_patterns where frequency >= 3 order by frequency desc limit 10;"
    )
    for row in recurring:
        log(f"health: recurring failure pattern {row['pattern_key']} x{row['frequency']}")
    db.run_sql("update public.loop_state set updated_at = now() where id = 'main';")
    log("health: heartbeat written")


def main() -> None:
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(0)
    cmd = args[0]
    if cmd == "status":
        cmd_status()
    elif cmd == "run" and len(args) >= 2:
        cmd_run(args[1])
    elif cmd == "approve" and len(args) >= 2:
        cmd_approve(args[1])
    elif cmd == "rollback" and len(args) >= 2:
        cmd_rollback(args[1], " ".join(args[2:]) or "manual rollback via loopctl")
    elif cmd == "health":
        cmd_health()
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
