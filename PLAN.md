# PLAN — loop-engineering-dashboard

- **URL:** https://loop-engineering-dashboard.vercel.app
- **GitHub:** maximoseo/loop-engineering-dashboard
- **Category:** AI / Automation
- **Status:** live · HTTP 200 "Loop Engineering Dashboard | Maximo SEO" (~1.5KB shell)
- **Purpose:** Self-improving agent loop — observe, score, learn, propose, test, activate, monitor, evals, rollbacks.

## 1. Snapshot
This is the closed-loop improvement engine. The 1.5KB shell means front-end is thin — the value must be in showing the loop's real decisions and their measured impact.

## 2. Code Improvements
- **Persist every loop stage** (observe→score→propose→test→activate→monitor→rollback) as an auditable event chain in Supabase.
- **Eval harness** with versioned datasets + deterministic seeds; store eval runs and diffs.
- **Safe activation gate**: a proposal cannot activate unless eval delta ≥ threshold and a rollback plan exists.
- **Add `/api/health`** + `/api/loop-status` (current stage, last activation, last rollback).
- Golden tests for scoring + rollback logic.

## 3. Design Improvements
- Loop visualization (stateful pipeline diagram) with live stage highlighting.
- Proposal diff view (before/after prompt/config) with eval-score delta.
- Activation history + rollback log timeline.
- "Why this changed" narrative per activation.

## 4. Real Results (not filler)
- **Eval score trend** per capability, with pass/fail against baselines.
- **Activation success rate** and **rollback rate** (loop's own quality metric).
- **Regression catches**: how many bad proposals were blocked pre-activation.
- **Net improvement**: measured lift on target metrics since last N activations.

## 5. Tool Integrations
- **Vercel Agent Runs / AI Gateway** for run + cost signals feeding "observe."
- **grill-me-codex / eval skills** already installed for adversarial testing.
- **Supabase** event store, **GitHub** to open PRs for accepted proposals.
- **Telegram** notifications on activation + rollback.

## 6. New Features
- **Shadow mode**: run a proposal in parallel without affecting prod, compare.
- **Auto-rollback** on live-metric regression after activation.
- **Human-in-the-loop approval** for high-risk proposals.
- **Experiment registry** linking each change to its measured outcome.

## 7. Priority Order
1. Persisted loop event chain + `/api/loop-status`.
2. Eval harness + activation gate.
3. Activation/rollback metrics + regression catches.
4. Shadow mode + auto-rollback.
5. Human approval + experiment registry.
