# Loop Engineering Dashboard

Self-improving agent loop engineering system — observe, score, learn, propose, test, activate.

## Quick Start

```bash
npm install
cp .env.example .env.local  # fill VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm run dev                 # localhost:3000
npm run verify              # lint + unit tests + build + Playwright smoke
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React 19 + TypeScript 6 |
| Build | Vite 8 |
| CSS | Tailwind CSS 4 |
| Hosting | Vercel |

## Features

- **Loop Visualization** — real-time loop phase tracking (Observe → Score → Learn → Propose → Test → Activate → Monitor)
- **Score Chart** — 100-point rubric breakdown + 50-iteration trend
- **Improvement Feed** — filterable skills/memory/prompt/config changes with eval scores and copy-only approval handoff
- **Iteration History** — searchable per-task scores, lessons, proposals, token usage, and detail panels
- **Failure Library** — known failure patterns with frequency and mitigation
- **Optimization Backlog** — pending improvement proposals
- **Eval Results** — regression eval pass/warn/fail status
- **Production DataHealth** — explicit live/partial/demo/error modes, Supabase table counts, latency, and operator warnings

## Architecture

See [LOOP_ENGINEERING_PLAN.md](./LOOP_ENGINEERING_PLAN.md) for the full system architecture.

## Deploy

Production env vars must be configured in Vercel:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Deploy to the existing project:

```bash
vercel deploy --prod --yes --scope maximo-seo --no-color
```

See [`docs/production-runbook.md`](./docs/production-runbook.md) for operating, verification, and rollback steps.

## Part of

[Maximo SEO Dashboards Panel](https://dashboards-panel.maximo-seo.ai)

## Production Sources

| Source | URL |
|---|---|
| Production dashboard | https://loop-engineering-dashboard.vercel.app |
| GitHub repository | https://github.com/maximoseo/loop-engineering-dashboard |
| Vercel project | `loop-engineering-dashboard` in `maximo-seo` |

## Improvement Roadmap

The active improvement plan lives in [`docs/loop-engineering-dashboard-improvement-roadmap.md`](./docs/loop-engineering-dashboard-improvement-roadmap.md). The plan targets this existing repo and the existing Vercel production dashboard; it does not create a duplicate dashboard.

## Production Verification

```bash
npm run lint
npm run build
vercel inspect https://loop-engineering-dashboard.vercel.app
curl -I https://loop-engineering-dashboard.vercel.app
```

