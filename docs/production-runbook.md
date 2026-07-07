# Loop Engineering Dashboard — Production Runbook

## Production targets

| Surface | URL |
|---|---|
| Dashboard | https://loop-engineering-dashboard.vercel.app |
| GitHub | https://github.com/maximoseo/loop-engineering-dashboard |
| Vercel | https://vercel.com/maximo-seo/loop-engineering-dashboard |
| Dashboard of Dashboards | https://dashboards-panel.maximo-seo.ai |

## Environment variables

The frontend reads Supabase through Vite public env vars. Configure these in Vercel Production and in `.env.local` for local development:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Do **not** put Supabase service-role keys in the frontend. This dashboard is read-only; writes/approvals happen through CLI handoff commands and audited backend scripts.

## Data health contract

The dashboard classifies data mode as:

| Mode | Meaning | Operator action |
|---|---|---|
| `live` | All required tables counted, iterations exist, no fetch errors | Normal operations |
| `partial` | Iterations exist but one or more tables/queries failed | Inspect `Operator attention` and stale tables |
| `demo` | Supabase is missing or `loop_iterations` is empty | Do not trust metrics as production telemetry |
| `error` | All required table counts failed | Check Vercel env, Supabase RLS/API, network |

Required tables:

- `loop_iterations`
- `loop_state`
- `loop_scores`
- `loop_proposals`
- `loop_failure_patterns`
- `loop_lessons`
- `loop_eval_results`

## Safe task intake workflow

The `New task` panel lets an operator write a Loop Engineering task/project and press `Send task`.

Runtime behavior:

1. Browser captures the task, type, priority, and requested destination.
2. `/api/loop-task` validates the payload server-side.
3. If `LOOP_TASK_PUBLIC_ENABLED=true` and a delivery channel exists, the endpoint forwards the task to either:
   - `LOOP_TASK_WEBHOOK_URL` for a worker/Hermes bridge, or
   - `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` for Telegram delivery.
4. The UI updates the process tracker: capture → validate → send → track.
5. If delivery env is missing/disabled, the UI shows `Configuration required` and does **not** pretend the task ran.

Required env to enable real delivery:

```text
LOOP_TASK_PUBLIC_ENABLED=true
```

Choose one delivery channel:

```text
LOOP_TASK_WEBHOOK_URL
LOOP_TASK_WEBHOOK_SECRET # optional bearer secret
```

or:

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
```

The task intake is intentionally separated from proposal approval. Proposal approvals still require the audited CLI workflow below.

## Safe approval workflow

The UI intentionally does not mutate production state. For a proposal:

1. Open the proposal detail panel.
2. Copy the CLI approval command.
3. Run it from a secure operator shell after reviewing the target/risk/evals:

```bash
python scripts/loopctl.py approve <proposal-id>
```

## Verification commands

Before deploy:

```bash
npm run lint
npm run test
npm run build
npm run test:e2e
```

After deploy:

```bash
vercel inspect https://loop-engineering-dashboard.vercel.app --scope maximo-seo
PLAYWRIGHT_BASE_URL=https://loop-engineering-dashboard.vercel.app npm run test:e2e
python3 /root/.hermes/scripts/check_deploy_failure_email.py
```

Also verify the Dashboard of Dashboards card points to the production dashboard URL, not the Vercel admin page.

## Rollback

If a deploy breaks production:

1. Use Vercel dashboard/CLI to promote the previous Ready deployment.
2. Revert the GitHub commit or push a hotfix.
3. Re-run production smoke and mailbox failure checks.

## Current real-world upgrades

- Explicit DataHealth status: live/partial/demo/error.
- Supabase config via env only; no hardcoded project/key fallback in source.
- Table-count telemetry and fetch latency in the production status panel.
- Operator filters/search for improvements and iterations.
- Detail panels for proposals and iterations.
- Copy-only safe approval handoff; no public mutation endpoint.
- Unit tests and Playwright desktop/mobile smoke tests.
