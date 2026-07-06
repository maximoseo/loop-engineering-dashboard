# Loop Engineering Dashboard

Self-improving agent loop engineering system — observe, score, learn, propose, test, activate.

## Quick Start

```bash
npm install
npm run dev      # localhost:3000
npm run build    # production build → dist/
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
- **Improvement Feed** — skills/memory/prompt/config changes with eval scores
- **Iteration History** — per-task scores, lessons, proposals, token usage
- **Failure Library** — known failure patterns with frequency and mitigation
- **Optimization Backlog** — pending improvement proposals
- **Eval Results** — regression eval pass/warn/fail status

## Architecture

See [LOOP_ENGINEERING_PLAN.md](./LOOP_ENGINEERING_PLAN.md) for the full system architecture.

## Deploy

```bash
vercel --prod
```

## Part of

[Maximo SEO Dashboards Panel](https://dashboards-panel.maximo-seo.ai)
