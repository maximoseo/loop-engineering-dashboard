"""Phase 6 ACTIVATE/ROLLBACK + Phase 7 MONITOR.

- Tests proposed changes against the eval suite.
- Low-risk passing proposals auto-activate (file write restricted to the managed
  whitelist, with a rollback snapshot taken first).
- Medium/high risk or manual targets become pending_approval (loopctl.py approve).
- Monitoring: if the rolling task-score average drops >10 points within 24h of an
  activation, the change is rolled back automatically and tagged in the failure library.
"""
from __future__ import annotations

import sys
from pathlib import Path

from lib import db
from lib.common import MANAGED_SKILLS_DIR, ROLLBACK_DIR, RunLock, log, now_iso, write_json
from run_evals import test_proposal

MONITOR_WINDOW_H = 24
SCORE_DROP_LIMIT = 10


def is_whitelisted(path: str) -> bool:
    if path.startswith("manual:"):
        return False
    try:
        return Path(path).resolve().is_relative_to(MANAGED_SKILLS_DIR.resolve())
    except (OSError, ValueError):
        return False


def snapshot(proposal: dict) -> str:
    snap_dir = ROLLBACK_DIR / proposal["proposal_id"]
    target = proposal["target"]
    payload = {
        "proposal_id": proposal["proposal_id"],
        "target": target,
        "old_value": proposal.get("old_value") or "",
        "existed": Path(target).exists() if not target.startswith("manual:") else False,
        "taken_at": now_iso(),
    }
    write_json(snap_dir / "snapshot.json", payload)
    return str(snap_dir / "snapshot.json")


def apply_change(proposal: dict) -> None:
    target = Path(proposal["target"])
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(proposal.get("new_value") or "", encoding="utf-8")


def revert_change(proposal: dict, snap_path: str) -> None:
    from lib.common import read_json

    snap = read_json(Path(snap_path), {})
    target = Path(proposal["target"])
    if snap.get("existed"):
        target.write_text(snap.get("old_value") or "", encoding="utf-8")
    elif target.exists():
        target.unlink()


def transition(proposal: dict, expected: str, next_status: str, action: str, reason: str,
               eval_summary: dict, snap_path: str | None = None) -> None:
    result = db.rpc(
        "transition_loop_proposal",
        {
            "p_workspace_id": db.workspace_id(),
            "p_proposal_id": proposal["proposal_id"],
            "p_expected_status": expected,
            "p_next_status": next_status,
            "p_action": action,
            "p_reason": reason[:300],
            "p_snapshot_path": snap_path,
            "p_eval_summary": eval_summary,
        },
    )
    if result != "applied":
        raise db.DbError(f"proposal transition failed: {result}")
    proposal["status"] = next_status
    proposal["eval_summary"] = eval_summary


def activate(proposal: dict, eval_summary: dict, via: str) -> None:
    snap_path = snapshot(proposal)
    apply_change(proposal)
    try:
        transition(proposal, proposal["status"], "active", "activated", via, eval_summary, snap_path)
    except Exception:
        # Filesystems and Postgres cannot share a transaction. Restore the exact
        # snapshot when the atomic DB state/audit transition does not commit.
        revert_change(proposal, snap_path)
        raise
    log(f"activate: {proposal['proposal_id']} applied to {proposal['target']} ({via})")


def rollback(proposal_id: str, reason: str) -> bool:
    rows = db.select("loop_proposals", f"proposal_id=eq.{proposal_id}")
    if not rows:
        log(f"rollback: proposal {proposal_id} not found")
        return False
    proposal = rows[0]
    snap_path = str(ROLLBACK_DIR / proposal_id / "snapshot.json")
    if not Path(snap_path).exists():
        log(f"rollback: no snapshot for {proposal_id}")
        return False
    active_target = Path(proposal["target"])
    active_existed = active_target.exists()
    active_content = active_target.read_text(encoding="utf-8") if active_existed else ""
    revert_change(proposal, snap_path)
    summary = dict(proposal.get("eval_summary") or {})
    summary["rolled_back_reason"] = reason[:200]
    try:
        transition(proposal, "active", "rolled_back", "rolled_back", reason, summary, snap_path)
    except Exception as exc:
        # DB did not commit the rollback; restore the active file to match DB.
        if active_existed:
            active_target.parent.mkdir(parents=True, exist_ok=True)
            active_target.write_text(active_content, encoding="utf-8")
        elif active_target.exists():
            active_target.unlink()
        log(f"rollback: compensated file after DB failure for {proposal_id}: {exc}")
        return False
    db.run_sql(
        f"""
        insert into public.loop_failure_patterns (workspace_id, pattern_key, description, severity, examples)
        values ({db.sql_literal(db.workspace_id())}, {db.sql_literal('failed-proposal-' + proposal_id)},
                {db.sql_literal('Rolled back: ' + reason[:150])}, 'high',
                {db.sql_literal([proposal_id])})
        on conflict (workspace_id, pattern_key) do update set frequency = public.loop_failure_patterns.frequency + 1, last_seen = now();
        """
    )
    log(f"rollback: {proposal_id} reverted ({reason})")
    return True


def process_proposed() -> int:
    proposals = db.select("loop_proposals", "status=eq.proposed&order=created_at.asc&limit=2")
    if not proposals:
        log("activate: no proposed items")
        return 0
    db.set_loop_state("testing")
    handled = 0
    for proposal in proposals:
        pid = proposal["proposal_id"]
        if not is_whitelisted(proposal["target"]):
            transition(proposal, "proposed", "pending_approval", "pending_approval",
                       "target requires human application", dict(proposal.get("eval_summary") or {}))
            log(f"activate: {pid} -> pending_approval (manual target)")
            handled += 1
            continue

        if proposal.get("eval_required", True):
            db.update("loop_proposals", f"proposal_id=eq.{pid}", {"status": "testing"})
            proposal["status"] = "testing"
            db.set_loop_state("testing", active_proposal_id=pid)
            passed, summary = test_proposal(proposal)
            if not passed:
                transition(proposal, "testing", "rejected", "rejected",
                           summary.get("verdict", ""), summary)
                log(f"activate: {pid} rejected ({summary.get('verdict')})")
                handled += 1
                continue
        else:
            summary = {"verdict": "eval not required (low-risk memory append)"}

        db.set_loop_state("activating", active_proposal_id=pid)
        if proposal["risk_level"] == "low":
            activate(proposal, summary, "auto (evals passed, low risk)")
        else:
            transition(proposal, proposal["status"], "pending_approval", "pending_approval",
                       f"risk={proposal['risk_level']}, evals passed", summary)
            log(f"activate: {pid} -> pending_approval (risk {proposal['risk_level']})")
        handled += 1
    db.set_loop_state("monitoring")
    return handled


def monitor() -> None:
    """Rolls back recent activations if task scores regress."""
    rows = db.run_sql(
        f"""
        with recent_activations as (
          select a.proposal_id, a.created_at
          from public.loop_activations a
          join public.loop_proposals p on p.workspace_id = a.workspace_id and p.proposal_id = a.proposal_id
          where a.workspace_id = {db.sql_literal(db.workspace_id())}
            and a.action = 'activated'
            and p.status = 'active'
            and a.created_at > now() - interval '{MONITOR_WINDOW_H} hours'
        )
        select ra.proposal_id,
          (select avg(total) from public.loop_scores s where s.workspace_id = {db.sql_literal(db.workspace_id())} and s.created_at < ra.created_at
             and s.created_at > ra.created_at - interval '7 days') as before_avg,
          (select avg(total) from public.loop_scores s where s.workspace_id = {db.sql_literal(db.workspace_id())} and s.created_at >= ra.created_at) as after_avg,
          (select count(*) from public.loop_scores s where s.workspace_id = {db.sql_literal(db.workspace_id())} and s.created_at >= ra.created_at) as after_n
        from recent_activations ra;
        """
    )
    for row in rows:
        before = row.get("before_avg")
        after = row.get("after_avg")
        n = int(row.get("after_n") or 0)
        if before is None or after is None or n < 3:
            continue
        drop = float(before) - float(after)
        if drop > SCORE_DROP_LIMIT:
            rollback(row["proposal_id"], f"avg score dropped {drop:.1f} points within {MONITOR_WINDOW_H}h (n={n})")
    db.set_loop_state("idle", active_proposal_id=None)


if __name__ == "__main__":
    with RunLock("activate", stale_after_s=7200):
        if "--monitor-only" in sys.argv:
            monitor()
        else:
            process_proposed()
            monitor()
