import type { DataHealth, LoopPhase, LoopState } from '../types.ts'

interface Props {
  state: LoopState
  health: DataHealth
  live: boolean
  elapsed: number
  onRefresh: () => void
}

const productionUrl = 'https://loop-engineering-dashboard.vercel.app'
const githubUrl = 'https://github.com/maximoseo/loop-engineering-dashboard'
const vercelUrl = 'https://vercel.com/maximo-seo/loop-engineering-dashboard'
const dashboardPanelUrl = 'https://dashboards-panel.maximo-seo.ai'
const runbookUrl = 'https://github.com/maximoseo/loop-engineering-dashboard/blob/main/docs/production-runbook.md'

const phaseCopy: Record<LoopPhase, string> = {
  IDLE: 'Waiting for the next run.',
  OBSERVING: 'Reading recent sessions and tool usage.',
  SCORING: 'Scoring agent quality with the rubric.',
  LEARNING: 'Extracting reusable lessons and failures.',
  PROPOSING: 'Drafting safe improvements for review.',
  TESTING: 'Checking proposals against evals.',
  ACTIVATING: 'Ready for approved activation.',
  MONITORING: 'Watching for regressions and rollbacks.',
}

const steps = [
  ['Observe', 'collect sessions'],
  ['Score', 'grade quality'],
  ['Learn', 'extract lessons'],
  ['Propose', 'draft fixes'],
  ['Approve', 'human handoff'],
] as const

const formatElapsed = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 1) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}

const healthTone = (mode: DataHealth['mode']) => {
  if (mode === 'live') return 'good'
  if (mode === 'partial') return 'warn'
  if (mode === 'error') return 'bad'
  return 'neutral'
}

function SourceLink({ href, label, meta, aria }: { href: string; label: string; meta: string; aria: string }) {
  return (
    <a className="source-link" href={href} target="_blank" rel="noopener noreferrer" aria-label={aria}>
      <span>
        <strong>{label}</strong>
        <small>{meta}</small>
      </span>
      <span aria-hidden="true">↗</span>
    </a>
  )
}

export function OperationalOverview({ state, health, live, elapsed, onRefresh }: Props) {
  const pendingReview = state.recent_improvements.filter((item) => item.status === 'pending_approval' || item.status === 'proposed').length
  const highRisk = state.recent_improvements.filter((item) => item.risk_level === 'high').length
  const tableIssues = health.errors.length + health.staleTables.length
  const tone = healthTone(health.mode)
  const nextAction = tableIssues > 0
    ? 'Fix data-source issues before approving any proposal.'
    : pendingReview > 0
      ? 'Review pending proposals, then approve only through CLI handoff.'
      : 'Monitor score trend and failure patterns; no action is required right now.'

  return (
    <section id="overview" className="overview-shell" aria-labelledby="overview-title">
      <div className="overview-main">
        <div className="eyebrow-row">
          <span className={`status-pill ${tone}`}>{live ? `Production ${health.mode}` : `Fallback ${health.mode}`}</span>
          <span className="status-pill neutral">Updated {formatElapsed(elapsed)}</span>
          <span className="status-pill neutral">Read-only approval surface</span>
        </div>

        <div className="overview-title-row">
          <div>
            <p className="section-kicker">Loop Engineering Dashboard</p>
            <h2 id="overview-title">A control room for improving agents safely.</h2>
            <p className="overview-lead">
              It watches real loop telemetry, shows what the agents are learning, flags what needs review, and links operators to the exact places needed to approve, deploy, or debug changes.
            </p>
          </div>
          <div className="phase-card" aria-label="Current loop phase">
            <small>Current phase</small>
            <strong>{state.current_phase}</strong>
            <span>{phaseCopy[state.current_phase]}</span>
          </div>
        </div>

        <div className="workflow-strip" aria-label="Loop workflow">
          {steps.map(([title, subtitle], index) => (
            <div key={title} className="workflow-step">
              <span>{index + 1}</span>
              <strong>{title}</strong>
              <small>{subtitle}</small>
            </div>
          ))}
        </div>

        <div className="operator-grid">
          <div className="operator-card">
            <small>Needs review</small>
            <strong>{pendingReview} proposal{pendingReview === 1 ? '' : 's'}</strong>
            <span>{highRisk} high-risk item{highRisk === 1 ? '' : 's'} surfaced.</span>
          </div>
          <div className="operator-card">
            <small>Data proof</small>
            <strong>{tableIssues} table issues</strong>
            <span>{health.mode === 'live' ? 'Supabase tables responded.' : 'Check production data health.'}</span>
          </div>
          <div className="operator-card wide">
            <small>Next best action</small>
            <strong>{nextAction}</strong>
            <span>Browser actions stay safe; approval happens through the CLI command below.</span>
          </div>
        </div>

        <div className="overview-actions">
          <a className="action-button primary" href="#improvements">Review proposals</a>
          <button className="action-button" onClick={onRefresh}>Refresh live data</button>
          <a className="action-button" href="#production">Inspect data health</a>
        </div>
      </div>

      <aside className="overview-side" aria-labelledby="connected-sources-title">
        <div>
          <p className="section-kicker">Connected sources</p>
          <h3 id="connected-sources-title">Where to operate next</h3>
        </div>
        <div className="source-list">
          <SourceLink href={productionUrl} label="Production dashboard" meta="Live UI" aria="Production dashboard opens in a new tab" />
          <SourceLink href={githubUrl} label="GitHub repository" meta="Code + runbook" aria="GitHub repository opens in a new tab" />
          <SourceLink href={vercelUrl} label="Vercel project" meta="Deployments" aria="Vercel project opens in a new tab" />
          <SourceLink href={dashboardPanelUrl} label="Dashboards panel" meta="Control center" aria="Dashboards panel opens in a new tab" />
        </div>
        <div className="handoff-box">
          <small>Safe agent handoff</small>
          <code>python scripts/loopctl.py approve &lt;proposal-id&gt;</code>
        </div>
        <a className="runbook-link" href={runbookUrl} target="_blank" rel="noopener noreferrer" aria-label="Production runbook opens in a new tab">Open production runbook ↗</a>
      </aside>
    </section>
  )
}
