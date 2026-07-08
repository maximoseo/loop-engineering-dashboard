#!/usr/bin/env python3
"""Hermes-safe orchestrator worker MVP.

This worker leases assignments from the dashboard orchestrator API, writes an audit event,
and completes safe planning/verification assignments with a supervised summary. It does
not run arbitrary shell commands or mutate repositories; risky execution is marked as
needs_review so a human/operator can approve the next step.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

DEFAULT_BASE_URL = "https://loop-engineering-dashboard.vercel.app"
DEFAULT_AGENTS = ["planner", "qa_verifier", "security_guard", "orchestrator"]


def load_env(path: str) -> None:
    p = Path(path).expanduser()
    if not p.exists():
        return
    for line in p.read_text().splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def post(base_url: str, token: str, payload: dict) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        base_url.rstrip("/") + "/api/orchestrator",
        data=data,
        method="POST",
        headers={"content-type": "application/json", "authorization": f"Bearer {token}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code}: {body}") from exc


def summarize_assignment(assignment: dict) -> tuple[str, dict]:
    agent = assignment.get("agent_id", "unknown")
    input_data = assignment.get("input") or {}
    title = input_data.get("title") or "Assignment"
    objective = input_data.get("objective") or "No objective supplied."
    if agent in {"planner", "orchestrator"}:
        summary = f"Supervised plan prepared for: {title}. Objective: {objective}. Next step: assign implementation lanes and require verifier evidence before deployment."
        return "needsReview", {"summary": summary, "nextAction": "Human/operator should approve concrete implementation scope.", "safeMode": True}
    if agent == "qa_verifier":
        summary = "Verifier lane ready. It requires real test/build/browser evidence before marking the run done."
        return "needsReview", {"summary": summary, "requiredEvidence": ["npm run verify", "vercel build", "production browser QA", "secret scan"], "safeMode": True}
    if agent == "security_guard":
        summary = "Security lane ready. High-risk actions require approval; secrets must remain server-side only."
        return "needsReview", {"summary": summary, "approvalPolicy": "deploy/db/email/destructive actions require approval", "safeMode": True}
    summary = f"{agent} assignment leased successfully but not executed by MVP safe worker."
    return "needsReview", {"summary": summary, "reason": "MVP worker avoids autonomous code or production mutation.", "safeMode": True}


def run_once(base_url: str, token: str, worker_id: str, agents: list[str]) -> dict:
    lease = post(base_url, token, {"action": "lease", "workerId": worker_id, "agentIds": agents})
    assignment = lease.get("assignment")
    if not assignment:
        return {"ok": True, "leased": False, "message": "No queued assignment available."}
    post(base_url, token, {
        "action": "workerEvent",
        "runId": assignment["run_id"],
        "assignmentId": assignment["assignment_id"],
        "agentId": assignment["agent_id"],
        "eventType": "worker_safe_mode_started",
        "message": f"{worker_id} leased assignment in supervised safe mode.",
        "metadata": {"workerId": worker_id},
    })
    action, output = summarize_assignment(assignment)
    complete = post(base_url, token, {
        "action": action,
        "assignmentId": assignment["assignment_id"],
        "output": output,
        "summary": output.get("summary"),
    })
    return {"ok": True, "leased": True, "assignmentId": assignment["assignment_id"], "agentId": assignment["agent_id"], "complete": complete.get("assignment", {})}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default=os.environ.get("ORCHESTRATOR_BASE_URL", DEFAULT_BASE_URL))
    parser.add_argument("--worker-id", default=os.environ.get("ORCHESTRATOR_WORKER_ID", "hermes-safe-worker"))
    parser.add_argument("--agents", default=",".join(DEFAULT_AGENTS))
    parser.add_argument("--loops", type=int, default=1)
    parser.add_argument("--sleep", type=float, default=2.0)
    parser.add_argument("--env", default="/root/.hermes/secure/orchestrator-worker-token.env")
    args = parser.parse_args()
    load_env(args.env)
    token = os.environ.get("ORCHESTRATOR_WORKER_TOKEN")
    if not token:
        print(json.dumps({"ok": False, "message": "ORCHESTRATOR_WORKER_TOKEN missing"}))
        return 2
    agents = [part.strip() for part in args.agents.split(",") if part.strip()]
    results = []
    for index in range(args.loops):
      result = run_once(args.base_url, token, args.worker_id, agents)
      results.append(result)
      if not result.get("leased"):
          break
      if index + 1 < args.loops:
          time.sleep(args.sleep)
    print(json.dumps({"ok": True, "results": results}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
