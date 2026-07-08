import type { DataHealth, LoopState } from '../types.ts'

interface OperatorCommandCenterProps {
  state: LoopState
  health: DataHealth
  live: boolean
  elapsed: number
}

function healthLabel(live: boolean, issues: number) {
  if (!live) return 'Demo / fallback'
  if (issues > 0) return 'Needs attention'
  return 'All systems ready'
}

export function OperatorCommandCenter({ state, health, live, elapsed }: OperatorCommandCenterProps) {
  const pendingProposals = state.recent_improvements.filter((item) => item.status === 'proposed' || item.status === 'pending_approval')
  const highRisk = state.recent_improvements.filter((item) => item.risk_level === 'high')
  const issues = health.errors.length + health.staleTables.length
  const latestProposal = pendingProposals[0] || state.recent_improvements[0]

  return (
    <section id="operator-center" className="operator-command-grid" aria-label="Operator command center">
      <article className="operator-card today-card">
        <p className="section-kicker">Today in Loop Engineering</p>
        <h2>Start with the highest-signal work.</h2>
        <div className="operator-stat-grid">
          <div><small>Needs review</small><strong>{pendingProposals.length}</strong><span>pending proposals</span></div>
          <div><small>High risk</small><strong>{highRisk.length}</strong><span>human check</span></div>
          <div><small>Latest score</small><strong>{state.last_score.total}/100</strong><span>current run</span></div>
          <div><small>Live data</small><strong>{live ? 'Fresh' : 'Fallback'}</strong><span>{elapsed}s ago</span></div>
        </div>
      </article>

      <article className="operator-card review-card" id="review-center">
        <p className="section-kicker">Review Center</p>
        <h2>{pendingProposals.length ? 'Proposal review required' : 'No urgent proposal review'}</h2>
        {latestProposal ? (
          <div className="review-focus">
            <strong>{latestProposal.target}</strong>
            <p>{latestProposal.description}</p>
            <div>
              <span className={`status-chip ${latestProposal.risk_level}`}>{latestProposal.risk_level} risk</span>
              <span className="status-chip">{latestProposal.status}</span>
              <span className="status-chip">{latestProposal.type}</span>
            </div>
            <code>python scripts/loopctl.py approve {latestProposal.id}</code>
          </div>
        ) : (
          <p className="operator-muted">No proposals returned from live data yet.</p>
        )}
      </article>

      <article className="operator-card health-card" id="health-center">
        <p className="section-kicker">Health & Data Quality</p>
        <h2>{healthLabel(live, issues)}</h2>
        <div className="health-stack">
          <div><small>Supabase</small><strong>{live ? 'connected' : 'fallback'}</strong></div>
          <div><small>Table issues</small><strong>{issues}</strong></div>
          <div><small>Fetch latency</small><strong>{health.fetchDurationMs ? `${Math.round(health.fetchDurationMs)}ms` : 'n/a'}</strong></div>
          <div><small>Score rows</small><strong>{health.tableCounts.loop_scores ?? '—'}</strong></div>
        </div>
      </article>
    </section>
  )
}
