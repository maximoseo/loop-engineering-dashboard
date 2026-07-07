import type { DataHealth, LoopPhase, LoopState } from '../types.ts'

interface Props {
  state: LoopState
  health: DataHealth
  live: boolean
  elapsed: number
  onRefresh: () => void
}

const phaseDescriptions: Record<LoopPhase, string> = {
  IDLE: 'Waiting for the next scheduled agent-loop run.',
  OBSERVING: 'Collecting recent agent sessions, tool calls, scores, and failures.',
  SCORING: 'Scoring recent runs against the operating rubric.',
  LEARNING: 'Extracting reusable lessons, guardrails, and failure patterns.',
  PROPOSING: 'Drafting safe improvements to skills, prompts, config, or memory.',
  TESTING: 'Running evals before any proposed change is trusted.',
  ACTIVATING: 'Ready for human-approved activation through the CLI handoff.',
  MONITORING: 'Watching activated changes for regressions and rollback signals.',
}

const formatElapsed = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}

function statusTone(mode: DataHealth['mode']) {
  if (mode === 'live') return 'border-[rgba(34,211,238,0.36)] bg-[rgba(34,211,238,0.10)] text-[var(--success)]'
  if (mode === 'partial') return 'border-[rgba(251,191,36,0.36)] bg-[rgba(251,191,36,0.10)] text-[var(--warning)]'
  if (mode === 'error') return 'border-[rgba(248,113,113,0.36)] bg-[rgba(248,113,113,0.10)] text-[var(--error)]'
  return 'border-[rgba(161,161,170,0.24)] bg-[rgba(161,161,170,0.08)] text-[var(--text-secondary)]'
}

function externalLinkProps(label: string) {
  return { target: '_blank', rel: 'noopener noreferrer', 'aria-label': `${label} opens in a new tab` }
}

const sourceLinks = [
  { label: 'Production dashboard', href: 'https://loop-engineering-dashboard.vercel.app', detail: 'Live UI' },
  { label: 'GitHub repository', href: 'https://github.com/maximoseo/loop-engineering-dashboard', detail: 'Code + runbook' },
  { label: 'Vercel project', href: 'https://vercel.com/maximo-seo/loop-engineering-dashboard', detail: 'Deployments' },
  { label: 'Dashboards panel', href: 'https://dashboards-panel.maximo-seo.ai', detail: 'Control center' },
]

export function AgentOperationsHub({ state, health, live, elapsed, onRefresh }: Props) {
  const pendingApprovals = state.recent_improvements.filter((item) => item.status === 'pending_approval' || item.status === 'proposed').length
  const highRisk = state.recent_improvements.filter((item) => item.risk_level === 'high').length
  const healthMode = health.mode
  const nextAction = healthMode === 'live'
    ? pendingApprovals > 0
      ? 'Review pending proposals and copy a CLI approval command only after eval/risk review.'
      : 'Monitor scores and failures; no public write action is exposed from this UI.'
    : 'Fix data-source health before trusting score or proposal metrics.'

  return (
    <section id="agent-ops" className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.75fr] gap-4 md:gap-6 animate-fade-in delay-1" aria-labelledby="agent-ops-title">
      <div className="relative overflow-hidden rounded-2xl panel-shell p-5 md:p-6">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--success)]/60 to-transparent" />
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className={`inline-flex min-h-8 items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ${statusTone(healthMode)}`}>
                <span className="h-2 w-2 rounded-full bg-current" />
                {live ? `Production ${healthMode}` : `Production ${healthMode}`}
              </span>
              <span className="inline-flex min-h-8 items-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/70 px-3 py-1 text-xs text-[var(--text-secondary)]">
                Refreshed {formatElapsed(elapsed)}
              </span>
            </div>

            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent-cyan)]">Agent operations cockpit</p>
            <h2 id="agent-ops-title" className="mt-2 text-2xl md:text-4xl font-bold tracking-[-0.04em] text-[var(--text)]">
              Understand, approve, and monitor loop-engineering improvements.
            </h2>
            <p className="mt-3 text-sm md:text-base leading-7 text-[var(--text-secondary)]">
              This dashboard turns real agent-loop telemetry into a human-reviewable workflow: observe sessions, score quality,
              extract lessons, propose improvements, run evals, and expose safe handoff commands for approved changes.
            </p>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)]/45 p-3">
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Now doing</p>
                <p className="mt-1 text-sm font-semibold text-[var(--text)]">{state.current_phase}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{phaseDescriptions[state.current_phase]}</p>
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)]/45 p-3">
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Needs review</p>
                <p className="mt-1 text-sm font-semibold text-[var(--text)]">{pendingApprovals} proposals · {highRisk} high risk</p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Approval remains outside the browser through a copied CLI command.</p>
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)]/45 p-3">
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Data proof</p>
                <p className="mt-1 text-sm font-semibold text-[var(--text)]">{health.staleTables.length + health.errors.length} table issues</p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{health.mode === 'live' ? 'All required Supabase tables responded.' : 'Inspect Production status before acting.'}</p>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-72 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)]/55 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Next best action</p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{nextAction}</p>
            <div className="mt-4 flex flex-col gap-2">
              <a className="action-button primary" href="#improvements">Review proposals</a>
              <button className="action-button" onClick={onRefresh}>Refresh live data</button>
              <a className="action-button" href="https://github.com/maximoseo/loop-engineering-dashboard/blob/main/docs/production-runbook.md" {...externalLinkProps('Production runbook')}>Open runbook</a>
            </div>
          </div>
        </div>
      </div>

      <aside className="rounded-2xl panel-shell p-5 md:p-6" aria-labelledby="agent-links-title">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Connected sources</p>
        <h3 id="agent-links-title" className="mt-2 text-xl font-bold text-[var(--text)]">Where the agents and operators go next</h3>
        <div className="mt-4 grid gap-2">
          {sourceLinks.map((link) => (
            <a key={link.href} href={link.href} {...externalLinkProps(link.label)} className="group flex min-h-14 items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)]/45 px-3 py-2 transition hover:border-[var(--accent-cyan)]/50 hover:bg-[var(--bg-elevated)]/75">
              <span>
                <span className="block text-sm font-semibold text-[var(--text)] group-hover:text-[var(--accent-cyan)]">{link.label}</span>
                <span className="block text-xs text-[var(--text-muted)]">{link.detail}</span>
              </span>
              <span className="text-[var(--text-muted)] group-hover:text-[var(--accent-cyan)]">↗</span>
            </a>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-[rgba(251,191,36,0.22)] bg-[rgba(251,191,36,0.08)] p-3">
          <p className="text-xs font-semibold text-[var(--warning)]">Safe agent handoff</p>
          <code className="mt-2 block overflow-x-auto rounded-lg bg-black/30 p-2 text-[11px] text-[var(--text-secondary)]">python scripts/loopctl.py approve &lt;proposal-id&gt;</code>
        </div>
      </aside>
    </section>
  )
}
