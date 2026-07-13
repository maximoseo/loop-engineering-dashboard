# Closed-loop writeback (loop tasks + orchestrator)

## Loop task status writeback

Hermes / workers can update a delivered task after Telegram dispatch:

```http
POST /api/loop-task
Authorization: Bearer $ORCHESTRATOR_WORKER_TOKEN
# or X-Worker-Token / LOOP_TASK_WORKER_TOKEN
Content-Type: application/json

{
  "action": "writeback",
  "taskId": "loop-task-…",
  "status": "running",
  "resultSummary": "optional summary",
  "message": "optional event message",
  "error": "optional error for failed",
  "actor": "hermes"
}
```

Allowed statuses: `accepted | running | needs_review | done | failed | archived`.

Effects:

- updates `loop_task_handoffs.status` (+ timestamps / process steps / result_summary)
- appends `loop_task_events` row (`task_{status}`)
- UI drawer shows Event timeline via `GET /api/loop-task?taskId=…`

## Orchestrator worker actions (Bearer worker token)

| action | purpose |
|---|---|
| `lease` | reclaim stale leases, heartbeat, claim next queued assignment |
| `heartbeat` | upsert `loop_worker_heartbeats` |
| `reclaimStale` | force reclaim expired `leased`/`running` leases |
| `workerEvent` | append assignment event |
| `complete` / `fail` / `needsReview` / `blocked` | finish assignment + clear lease |

Safe worker CLI:

```bash
python3 scripts/orchestrator_worker.py --loops 1 \
  --base-url https://loop-engineering-dashboard.vercel.app \
  --env /root/.hermes/secure/orchestrator-worker-token.env
```

Lease recovery: if `lease_expires_at < now` and status is `leased` or `running`, the assignment returns to `queued` with event `assignment_reclaimed`.
