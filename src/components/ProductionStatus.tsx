interface Props {
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

export function ProductionStatus({
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
  const mode = live ? 'Live Supabase data' : 'Demo fallback data'
  const modeColor = live ? 'var(--success)' : 'var(--warning)'
  const health = live && avgScore >= 70 && rolledBack <= Math.max(1, Math.floor(activated * 0.25))
    ? 'Healthy'
    : live
      ? 'Watch'
      : 'Demo'
  const healthColor = health === 'Healthy' ? 'var(--success)' : health === 'Watch' ? 'var(--warning)' : 'var(--text-muted)'
  const rollbackRate = activated + rolledBack === 0 ? 0 : Math.round((rolledBack / (activated + rolledBack)) * 100)

  const signals = [
    { label: 'Source', value: mode, color: modeColor },
    { label: 'Loop', value: live && isRunning ? 'Running' : 'Idle', color: live && isRunning ? 'var(--success)' : 'var(--text-muted)' },
    { label: 'Health', value: health, color: healthColor },
    { label: 'Rollback rate', value: `${rollbackRate}%`, color: rollbackRate > 25 ? 'var(--error)' : 'var(--success)' },
    { label: 'Eval rows', value: `${evalCount}`, color: evalCount ? 'var(--info)' : 'var(--warning)' },
    { label: 'Backlog', value: `${backlogCount}`, color: backlogCount ? 'var(--warning)' : 'var(--text-muted)' },
  ]

  return (
    <section id="production" className="glass gradient-border rounded-2xl p-4 md:p-5 animate-fade-in">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em]"
              style={{ background: `${modeColor}18`, color: modeColor }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: modeColor }} />
              {live ? 'Production Live' : 'Production Demo Fallback'}
            </span>
            <span className="rounded-full border border-[var(--border-default)] px-3 py-1 text-xs text-[var(--text-secondary)]">
              Vercel project: <strong className="text-[var(--text)]">loop-engineering-dashboard</strong>
            </span>
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-bold text-[var(--text)]">Production & data-source status</h2>
            <p className="mt-1 max-w-3xl text-sm text-[var(--text-secondary)]">
              This panel verifies the existing GitHub repo and existing Vercel deployment are the active targets. It makes
              live Supabase data vs demo fallback explicit before any operator reads the metrics.
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

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--text-muted)]">
        <span>Iterations: <strong className="text-[var(--text-secondary)]">{totalIterations}</strong></span>
        <span>Activated: <strong className="text-[var(--text-secondary)]">{activated}</strong></span>
        <span>Rolled back: <strong className="text-[var(--text-secondary)]">{rolledBack}</strong></span>
        <span>Last refresh: <strong className="text-[var(--text-secondary)]">{lastUpdated ? formatElapsed(elapsed) : 'pending first sync'}</strong></span>
      </div>
    </section>
  )
}
