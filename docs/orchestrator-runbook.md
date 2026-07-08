# Multi-Agent Orchestrator Runbook

## Production architecture

```text
Dashboard UI → /api/orchestrator → Supabase orchestration tables → leased workers → events/status back to dashboard
```

The dashboard is a control plane. Workers execute or mark work as `needs_review`; browser code never receives provider secrets or service-role keys.

## Main objects

- `loop_projects` — user-level project/objective.
- `loop_orchestrator_runs` — one orchestration attempt.
- `loop_agent_registry` — available bots/agents.
- `loop_model_profiles` — model routing profiles.
- `loop_agent_assignments` — leased work items.
- `loop_agent_events` — append-only audit trail.
- `loop_run_artifacts` — plans, screenshots, reports, logs.
- `loop_run_approvals` — human gates for risky actions.
- `loop_worker_heartbeats` — online/offline worker status.

## API

```http
GET  /api/orchestrator
GET  /api/orchestrator?runId=<run_id>
POST /api/orchestrator { action: "createRun", ... }
POST /api/orchestrator { action: "createApproval", ... }
```

Worker-only actions require `Authorization: Bearer $ORCHESTRATOR_WORKER_TOKEN`:

```http
POST /api/orchestrator { action: "lease", workerId, agentIds }
POST /api/orchestrator { action: "workerEvent", ... }
POST /api/orchestrator { action: "complete", assignmentId, output }
POST /api/orchestrator { action: "needsReview", assignmentId, output }
POST /api/orchestrator { action: "fail", assignmentId, error }
```

## Safe worker MVP

The included worker is intentionally conservative:

```bash
python3 scripts/orchestrator_worker.py --loops 3
```

It leases compatible assignments and marks them `needs_review` with a supervised summary. It does not run arbitrary shell commands, edit code, deploy, or mutate production. High-risk actions stay behind approval gates.

## Required production env

- `SUPABASE_URL` / `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` — server-side only
- `ORCHESTRATOR_WORKER_TOKEN` — server-side/worker only
- existing task-delivery vars for `/api/loop-task`

## Verification

1. Create run from dashboard.
2. Confirm project/run/assignments rows in Supabase through `/api/orchestrator`.
3. Run safe worker once.
4. Confirm assignment transitions `queued → leased → needs_review`.
5. Confirm events show `assignment_leased`, `worker_safe_mode_started`, `assignment_needs_review`, `run_reconciled`.
6. Confirm dashboard refresh shows worker heartbeat and lanes.

## Safety rules

- Browser can create and supervise runs, not execute privileged commands.
- Worker endpoints require `ORCHESTRATOR_WORKER_TOKEN`.
- Production deploys, DB migrations, external email/posts, credentials, and destructive commands require approval rows.
- Secrets are never rendered; dashboard shows configured/missing booleans only.
