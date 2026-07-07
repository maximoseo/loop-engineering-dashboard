# Loop Engineering System — Self-Improving Agent Architecture

> **Project:** `maximoseo/loop-engineering-dashboard`
> **Purpose:** A self-improving agent harness that observes real Hermes agent sessions, scores them, learns lessons, proposes skill improvements, tests them against regression evals, and activates or rolls back — with a public read-only dashboard.
> **Status:** Implemented (v1) — 2026-07-07
> **Dashboard:** https://loop-engineering-dashboard.vercel.app

---

## 1. What Actually Runs (corrected architecture)

The original draft assumed Linux paths, git-tracked JSON served by Vercel functions, and a set of helper skills/CLIs that were never installed. v1 replaces all of that:

| Concern | v1 implementation |
| --- | --- |
| Observed agent | **Hermes** (local Windows install, `%LOCALAPPDATA%\hermes`) |
| Observation source | Read-only SQLite reads of `state.db` (`sessions` + `messages`) |
| LLM judge | `hermes -z` headless mode (pin via `JUDGE_MODEL` in `scripts/.env`) |
| Data store | **Supabase** (`loop_*` tables, RLS: public SELECT, service-role writes) |
| Dashboard | React/Vite SPA on Vercel, polls Supabase every 30s, read-only |
| Loop control | **Local only** via `scripts/loopctl.py` (no public mutation endpoint) |
| Scheduler | Windows Task Scheduler (see section 5) |
| Eval runner | Self-contained Python (`scripts/run_evals.py`), no promptfoo |
| Improvement surface | Whitelisted managed folder: `%LOCALAPPDATA%\hermes\skills\loop-managed\` |

```
Windows PC                                        Cloud
┌──────────────────────────────────────┐   ┌──────────────┐
│ hermes state.db ──▶ observe.py       │   │              │
│                     score.py ──judge─┤   │   Supabase   │
│                     extract_lessons  ├──▶│  loop_* rows │
│                     propose.py       │   │   (RLS read) │
│                     run_evals.py     │   └──────┬───────┘
│                     activate_or_     │          │ anon SELECT
│                       rollback.py    │   ┌──────▼───────┐
│ Task Scheduler ──▶ loopctl.py        │   │ Vercel SPA   │
│ loop-managed skills ◀── activations  │   │ (read-only)  │
└──────────────────────────────────────┘   └──────────────┘
```

## 2. The Seven Phases

| Phase | Script | What it does |
| --- | --- | --- |
| OBSERVE | `scripts/observe.py` | Watermark scan of completed Hermes sessions (idle ≥30 min, ≥2 messages, max 5/run). Builds sanitized TaskObservation → `loop_iterations` + `data/iterations/*.json`. |
| SCORE | `scripts/score.py` | LLM-as-judge, 100-pt rubric: task_success 30, accuracy 15, user_alignment 15, tool_quality 10, efficiency 10, safety 10, validation 5, memory_learning 5. Caps (≤40 / ≤60) enforced in code, not trusted to the judge. → `loop_scores`. |
| LEARN | `scripts/extract_lessons.py` | Extracts 0-3 typed lessons per task (preference/procedure/pitfall/optimization) with confidence + evidence. Pitfalls also upsert `loop_failure_patterns`. → `loop_lessons`. |
| PROPOSE | `scripts/propose.py` | Lessons with confidence ≥0.8 become proposals. Skills → managed SKILL.md drafts; preferences → managed `preferences.md` append; prompt/config → informational, always human-gated. → `loop_proposals`. |
| TEST | `scripts/run_evals.py` | 8 behavioral evals (`scripts/evals.json`) run through `hermes -z`, graded by the judge. Baseline cached 24h. Pass rule: no eval −5, at least one +2, safety evals never below 80. → `loop_eval_results`. |
| ACTIVATE / ROLLBACK | `scripts/activate_or_rollback.py` | Passing + low-risk → auto-apply (snapshot first). Medium/high risk or non-whitelisted target → `pending_approval`. Failing → rejected + failure library. → `loop_activations`. |
| MONITOR | same script (`--monitor-only`) | If rolling task-score average drops >10 points within 24h of an activation (n≥3 scores), auto-rollback from snapshot and tag `failed-proposal-<id>`. |

## 3. Safety Guardrails (enforced in code)

- **Secret scanner** (`scripts/lib/sanitize.py`): 15 regex families (AWS/GitHub/OpenAI/Anthropic/Slack/Supabase/Stripe/Telegram keys, JWTs, bearer tokens, URL credentials, generic assignments). Every string is scrubbed before any DB row or file write; lessons containing secrets are dropped entirely.
- **Write whitelist**: activations may only write inside `%LOCALAPPDATA%\hermes\skills\loop-managed\`. Anything else (config, prompts, MCP) is informational and requires `loopctl.py approve` + manual application.
- **Bounded loops**: hard caps per run (5 sessions, 5 scores, 5 lesson tasks, 2 proposals) + run locks (`data/.lock-*`) prevent overlap; judge calls time out at 420s.
- **Rollback snapshots**: `data/rollback/<proposal_id>/snapshot.json` taken before every apply; restore is byte-exact (or file deletion if it did not exist).
- **Read-only public surface**: the dashboard has no mutation endpoint at all; RLS allows anon SELECT only, writes require the service role (scripts authenticate via the Supabase Management API token or `SUPABASE_SERVICE_KEY`, both local-only in gitignored `scripts/.env`).
- **Judge ≠ actor**: set `JUDGE_MODEL` in `scripts/.env` to grade with a different model than the Hermes default.

## 4. Data Model (Supabase, all RLS-enabled)

`loop_state` (singleton phase machine) · `loop_iterations` (task observations) · `loop_scores` (rubric breakdowns + caps) · `loop_lessons` (typed, confidence-weighted) · `loop_proposals` (old/new value, risk, status: proposed→testing→pending_approval/active/rejected/rolled_back) · `loop_eval_results` (per-eval scores, baseline links) · `loop_failure_patterns` (dedup by pattern_key, frequency counter) · `loop_activations` (audit trail with snapshot paths).

Migration: `supabase/migrations/20260707000000_loop_engineering_schema.sql`.

## 5. Schedules (Windows Task Scheduler)

| Task | Cadence | Command |
| --- | --- | --- |
| `LoopEngineering-Micro` | every 30 min | `loopctl.py run micro` (observe→score→learn) |
| `LoopEngineering-Improve` | every 2 h | `loopctl.py run improve` (propose→test→activate+monitor) |
| `LoopEngineering-Baseline` | every 6 h | `loopctl.py run baseline` (refresh eval baseline) |
| `LoopEngineering-Health` | daily 03:00 | `loopctl.py health` (heartbeat + recurring-failure scan) |

All tasks run `C:\Python314\python.exe` with the repo's `scripts/` as working directory; config comes from `scripts/.env` (gitignored).

## 6. Local Control

```
python scripts/loopctl.py status                  # phase, counts, pending approvals
python scripts/loopctl.py run micro|improve|baseline|cycle
python scripts/loopctl.py approve <proposal_id>   # apply a pending_approval proposal
python scripts/loopctl.py rollback <proposal_id> [reason]
python scripts/loopctl.py health
```

## 7. KPIs & Alert Conditions

| Metric | Target | Alarm |
| --- | --- | --- |
| Avg task score (7d) | > 80 | < 70 for 3 days |
| Eval pass rate | > 90% | any safety eval below 80 → auto-rollback of last activation |
| Activations/week | 5-15 | 0 (stagnation) or >20 (too aggressive) |
| Rollback rate | < 15% | > 25% |
| Failure recurrence | decreasing | same pattern_key ≥3× → surfaced by `loopctl.py health` |

## 8. Repo Layout

```
src/                     dashboard SPA (React 19 + Vite 8 + Tailwind 4)
src/data/liveData.ts     Supabase polling + mock fallback (DEMO badge when empty)
scripts/                 loop engine (Python 3.14, stdlib-only)
scripts/lib/             common, db, sanitize, hermes_reader, judge
scripts/evals.json       8 behavioral regression evals
supabase/migrations/     schema
data/                    (gitignored) iteration logs, watermark, locks, rollback snapshots
```

---

## 12. Improvement Roadmap — Existing Repo / Existing Vercel Dashboard

The next workstream targets the existing production system only:

- **GitHub repo:** `maximoseo/loop-engineering-dashboard`
- **Branch target:** `main` via feature branches / PRs
- **Vercel project:** `loop-engineering-dashboard`
- **Production URL:** https://loop-engineering-dashboard.vercel.app
- **Dashboard of Dashboards:** card should open the production URL, not the Vercel admin page

Full roadmap: [`docs/loop-engineering-dashboard-improvement-roadmap.md`](./docs/loop-engineering-dashboard-improvement-roadmap.md).

### 12.1 Priority improvements

1. Make live/demo/partial/error data source status explicit in the UI.
2. Add operational health signals: freshness, eval recency, rollback rate, pending approvals.
3. Add drill-down drawers for iterations, proposals, and failure patterns.
4. Keep the public dashboard read-only; all mutation remains local/controlled by `scripts/loopctl.py`.
5. Register and verify the dashboard in the Dashboard of Dashboards with correct GitHub/Vercel/source links.

### 12.2 Production QA checklist

- `npm run lint` passes.
- `npm run build` passes.
- Vercel deployment is `Ready`.
- `https://loop-engineering-dashboard.vercel.app` returns HTTP 200 with Vercel headers.
- Browser QA has no console errors on desktop and mobile.
- Dashboard of Dashboards includes exactly one active card for this dashboard.

