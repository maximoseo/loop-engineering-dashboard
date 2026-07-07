import type { DataHealth } from '../types.ts'

interface Props {
  health: DataHealth
  live: boolean
  isRunning: boolean
  lastUpdated: Date | null
  elapsed: number
  totalIterations: number
  avgScore: number
  activated: number
  rolledBack: number
  evalCount: number
  backlogCount: number
}

const formatElapsed = (seconds: number) => {
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}

const productionUrl = 'https://loop-engineering-dashboard.vercel.app'
const githubUrl = 'https://github.com/maximoseo/loop-engineering-dashboard'
const dashboardPanelUrl = 'https://dashboards-panel.maximo-seo.ai'

const modeConfig = {
  live: { label: 'Production Live', source: 'Live Supabase data', color: 'var(--success)' },
  partial: { label: 'Production Partial', source: 'Partial Supabase data', color: 'var(--warning)' },
  demo: { label: 'Production Demo Fallback', source: 'Demo fallback data', color: 'var(--warning)' },
  error: { label: 'Production Data Error', source: 'Supabase unavailable', color: 'var(--error)' },
} as const

const tableLabels: Record<keyof DataHealth['tableCounts'], string> = {
  loop_iterations: 'Iterations',
  loop_state: 'State',
  loop_scores: 'Scores',
  loop_proposals: 'Proposals',
  loop_failure_patterns: 'Failures',
  loop_lessons: 'Lessons',
  loop_eval_results: 'Evals',
}

export function ProductionStatus({
  health,
  live,
  isRunning,
  lastUpdated,
  elapsed,
  totalIterations,
  avgScore,
  activated,
  rolledBack,
  evalCount,
  backlogCount,
}: Props) {
  const mc = modeConfig[health.mode]
  const rollbackRate = activated + rolledBack === 0 ? 0 : Math.round((rolledBack / (activated + rolledBack)) * 100)
  const staleCount = health.staleTables.length
  const errorCount = health.errors.length
  const operationalHealth =
    health.mode === 'error'
      ? 'Broken'
      : health.mode === 'demo'
        ? 'Demo'
        : live && avgScore >= 70 && rollbackRate <= 25 && errorCount === 0
          ? 'Healthy'
          : 'Watch'
  const healthColor =
    operationalHealth === 'Healthy'
      ? 'var(--success)'
      : operationalHealth === 'Broken'
        ? 'var(--error)'
        : operationalHealth === 'Watch'
          ? 'var(--warning)'
          : 'var(--text-muted)'

  const signals = [
    { label: 'Source', value: mc.source, color: mc.color },
    { label: 'Loop', value: live && isRunning ? 'Running' : 'Idle', color: live && isRunning ? 'var(--success)' : 'var(--text-muted)' },
    { label: 'Health', value: operationalHealth, color: healthColor },
    { label: 'Rollback rate', value: `${rollbackRate}%`, color: rollbackRate > 25 ? 'var(--error)' : 'var(--success)' },
    { label: 'Fetch latency', value: health.fetchDurationMs === null ? '—' : `${health.fetchDurationMs}ms`, color: health.fetchDurationMs && health.fetchDurationMs > 1500 ? 'var(--warning)' : 'var(--info)' },
    { label: 'Table issues', value: `${staleCount + errorCount}`, color: staleCount + errorCount ? 'var(--warning)' : 'var(--success)' },
  ]

  return (
    <section id="production" className="glass gradient-border rounded-2xl p-4 md:p-5 animate-fade-in">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em]"
              style={{ background: `${mc.color}18`, color: mc.color }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: mc.color }} />
              {mc.label}
            </span>
            <span className="rounded-full border border-[var(--border-default)] px-3 py-1 text-xs text-[var(--text-secondary)]">
              Vercel project: <strong className="text-[var(--text)]">loop-engineering-dashboard</strong>
            </span>
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-bold text-[var(--text)]">Production & data-source status</h2>
            <p className="mt-1 max-w-3xl text-sm text-[var(--text-secondary)]">
              Real-world operating status for the existing GitHub repo, existing Vercel deployment, and Supabase data layer.
              Partial/error states are explicit so operators never mistake stale or demo data for live telemetry.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
          <a className="rounded-xl border border-[var(--border-default)] px-3 py-2 text-[var(--accent-bright)] hover:border-[var(--border-glow)]" href={productionUrl} target="_blank" rel="noreferrer">
            Production ↗
          </a>
          <a className="rounded-xl border border-[var(--border-default)] px-3 py-2 text-[var(--accent-bright)] hover:border-[var(--border-glow)]" href={githubUrl} target="_blank" rel="noreferrer">
            GitHub repo ↗
          </a>
          <a className="rounded-xl border border-[var(--border-default)] px-3 py-2 text-[var(--accent-bright)] hover:border-[var(--border-glow)]" href={dashboardPanelUrl} target="_blank" rel="noreferrer">
            Dashboards panel ↗
          </a>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {signals.map((signal) => (
          <div key={signal.label} className="rounded-xl bg-[var(--bg-elevated)]/50 border border-[var(--border-subtle)] p-3">
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{signal.label}</p>
            <p className="mt-1 text-sm font-semibold" style={{ color: signal.color }}>{signal.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
        {Object.entries(health.tableCounts).map(([table, count]) => (
          <div
            key={table}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/30 px-2 py-2"
            title={table}
          >
            <p className="text-[9px] uppercase tracking-wider text-[var(--text-dim)]">{tableLabels[table as keyof DataHealth['tableCounts']]}</p>
            <p className="text-xs font-mono text-[var(--text-secondary)]">{count ?? 'ERR'}</p>
          </div>
        ))}
      </div>

      {health.errors.length > 0 && (
        <div className="mt-4 rounded-xl border border-[rgba(251,191,36,0.25)] bg-[rgba(251,191,36,0.06)] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--warning)]">Operator attention</p>
          <ul className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
            {health.errors.slice(0, 4).map((error) => (
              <li key={error}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--text-muted)]">
        <span>Iterations: <strong className="text-[var(--text-secondary)]">{totalIterations}</strong></span>
        <span>Evals shown: <strong className="text-[var(--text-secondary)]">{evalCount}</strong></span>
        <span>Backlog: <strong className="text-[var(--text-secondary)]">{backlogCount}</strong></span>
        <span>Activated: <strong className="text-[var(--text-secondary)]">{activated}</strong></span>
        <span>Rolled back: <strong className="text-[var(--text-secondary)]">{rolledBack}</strong></span>
        <span>Last refresh: <strong className="text-[var(--text-secondary)]">{lastUpdated ? formatElapsed(elapsed) : 'pending first sync'}</strong></span>
        <span>Last successful data fetch: <strong className="text-[var(--text-secondary)]">{health.lastSuccessfulFetch ? new Date(health.lastSuccessfulFetch).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'none'}</strong></span>
      </div>
    </section>
  )
}
