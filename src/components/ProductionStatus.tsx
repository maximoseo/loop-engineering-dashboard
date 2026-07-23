import type { DataHealth } from '../types.ts'
import { formatTime } from '../lib/loopFormat.ts'

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
  live: { label: 'Production Live', source: 'Live Supabase data', tone: 'good' },
  partial: { label: 'Production Partial', source: 'Partial Supabase data', tone: 'warn' },
  demo: { label: 'Demo Fallback', source: 'Demo fallback data', tone: 'warn' },
  error: { label: 'Data Error', source: 'Supabase unavailable', tone: 'bad' },
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
  const tableIssues = health.errors.length + health.staleTables.length
  const operationalHealth =
    health.mode === 'error'
      ? 'Broken'
      : health.mode === 'demo'
        ? 'Demo'
        : live && avgScore >= 70 && rollbackRate <= 25 && tableIssues === 0
          ? 'Healthy'
          : 'Watch'

  const signals = [
    { label: 'Source', value: mc.source },
    { label: 'Loop', value: live && isRunning ? 'Running' : 'Idle' },
    { label: 'Health', value: operationalHealth },
    { label: 'Rollback', value: `${rollbackRate}%` },
    { label: 'Latency', value: health.fetchDurationMs === null ? '—' : `${health.fetchDurationMs}ms` },
    { label: 'Issues', value: `${tableIssues}` },
  ]

  return (
    <section id="production" className="data-proof-card" aria-labelledby="production-title">
      <div className="data-proof-header">
        <div>
          <span className={`data-proof-pill ${mc.tone}`}>{mc.label}</span>
          <h2 id="production-title">Live data proof</h2>
          <p>Runtime evidence from Supabase and Vercel. This section confirms the dashboard is not showing static mock data.</p>
        </div>
        <div className="data-proof-links">
          <a href={productionUrl} target="_blank" rel="noreferrer">Production ↗</a>
          <a href={githubUrl} target="_blank" rel="noreferrer">GitHub ↗</a>
          <a href={dashboardPanelUrl} target="_blank" rel="noreferrer">Panel ↗</a>
        </div>
      </div>

      <div className="signal-grid">
        {signals.map((signal) => (
          <div key={signal.label}>
            <small>{signal.label}</small>
            <strong>{signal.value}</strong>
          </div>
        ))}
      </div>

      <div className="table-proof-grid" aria-label="Supabase table counts">
        {Object.entries(health.tableCounts).map(([table, count]) => (
          <div key={table} title={table}>
            <small>{tableLabels[table as keyof DataHealth['tableCounts']]}</small>
            <strong>{count ?? 'ERR'}</strong>
          </div>
        ))}
      </div>

      {health.errors.length > 0 && (
        <div className="operator-attention">
          <strong>Operator attention</strong>
          <ul>
            {health.errors.slice(0, 4).map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="data-proof-footer">
        <span>Iterations <strong>{totalIterations}</strong></span>
        <span>Evals <strong>{evalCount}</strong></span>
        <span>Backlog <strong>{backlogCount}</strong></span>
        <span>Activated <strong>{activated}</strong></span>
        <span>Rolled back <strong>{rolledBack}</strong></span>
        <span>Refresh <strong>{lastUpdated ? formatElapsed(elapsed) : 'pending'}</strong></span>
        <span>Last good fetch <strong>{health.lastSuccessfulFetch ? formatTime(health.lastSuccessfulFetch) : 'none'}</strong></span>
      </div>
    </section>
  )
}
