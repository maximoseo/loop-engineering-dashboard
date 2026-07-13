# SSH fleet + bot control reality (dashboards)

## What is true on this server

- Host: `srv1713739` (root) runs Hermes Agent + Claude Code Telegram bots.
- Hermes config dir: `~/.hermes/` (profiles under `~/.hermes/profiles/<name>/`).
- Claude Telegram channel launcher: `claude --channels plugin:telegram@claude-plugins-official` in tmux session `claude-tg`.
- Dashboards on Vercel (Loop Engineering, Agentic OS, to-do-tasks) **do not** hold an interactive shell to bots. They talk over:

| Control surface | Direction | Auth | Notes |
|---|---|---|---|
| `POST /api/loop-task` create | dashboard → Supabase → Telegram | public when `LOOP_TASK_PUBLIC_ENABLED` | Delivers task text to configured chat |
| `POST /api/loop-task` writeback | worker/Hermes → queue | `ORCHESTRATOR_WORKER_TOKEN` / `LOOP_TASK_WORKER_TOKEN` | Closes the loop (status + events) |
| `POST /api/orchestrator` lease/heartbeat/complete | worker CLI → control plane | `ORCHESTRATOR_WORKER_TOKEN` | Multi-agent assignments |
| Supabase tables | shared state | service role (server only) | Not browser-readable with anon key |
| Telegram bots | user ↔ agent | BotFather tokens | Chat is human gateway; dashboards only deliver |

## What dashboards **cannot** do

- They cannot SSH into the VPS or send raw shell to Hermes/Claude processes.
- They cannot read worker secrets from the browser.
- They cannot force an agent session to wake unless Telegram/webhook delivery or a lease worker is running.

## Operator tasks to keep closed-loop alive

1. Keep Vercel env set: `ORCHESTRATOR_WORKER_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, Telegram pair, `LOOP_TASK_PUBLIC_ENABLED=true` when public queue is intentional.
2. Run a worker with that token on the VPS:
   ```bash
   python3 scripts/orchestrator_worker.py --loops 1 \
     --base-url https://loop-engineering-dashboard.vercel.app \
     --env /root/.hermes/secure/orchestrator-worker-token.env
   ```
3. After Hermes finishes a Telegram-delivered task, call writeback with the same token (see `docs/closed-loop-writeback.md`).
4. Store the worker token **only** under `~/.hermes/secure/` (mode `600`). Do not put it in frontend env (`VITE_*`).

## Mental model

```
User/UI → POST loop-task (create)
       → Supabase handoff + event
       → Telegram bot
       → Hermes/Claude work (local) 
       → POST writeback (token)
       → status/timeline visible on dashboard
```

SSH is for humans / agent tooling on the server. Dashboard control is **API + queue**, not SSH.
