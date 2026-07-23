import { useDashboard } from '../contexts/DashboardContext.tsx'
import { exportCsv } from '../lib/exportCsv.ts'
import { formatTimestamp } from '../lib/loopFormat.ts'

const actionTone: Record<string, string> = {
  activated: '#22c55e',
  approved: '#22d3ee',
  pending_approval: '#60a5fa',
  rejected: '#f87171',
  rolled_back: '#fbbf24',
}

export default function ActivationsPage() {
  const { state } = useDashboard()
  const rows = state.activations ?? []

  return (
    <div className="dashboard-content">
      <section className="lower-intelligence-deck" aria-label="Activation ledger">
        <div className="deck-hero">
          <div>
            <p className="deck-eyebrow">Activate / Monitor</p>
            <h2>Activation &amp; rollback ledger</h2>
            <p>Every activation, approval, rejection and auto-rollback the loop has applied — the ACTIVATE / MONITOR audit trail.</p>
          </div>
          <button className="ghost-button" onClick={() => exportCsv('loop-activations.csv', rows)} disabled={!rows.length}>
            Export CSV
          </button>
        </div>
        <div className="glass-card" style={{ overflowX: 'auto' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[var(--text-secondary)]">
                <th className="p-2 font-medium">When</th>
                <th className="p-2 font-medium">Action</th>
                <th className="p-2 font-medium">Proposal</th>
                <th className="p-2 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="border-b border-[var(--border)]/50">
                  <td className="p-2 font-mono text-xs text-[var(--text-muted)]">{formatTimestamp(a.created_at)}</td>
                  <td className="p-2">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{ background: `${actionTone[a.action] ?? '#71717a'}20`, color: actionTone[a.action] ?? '#a1a1aa' }}
                    >
                      {a.action.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-2 font-mono text-xs text-[var(--text-secondary)]">{a.proposal_id}</td>
                  <td className="p-2 text-[var(--text-secondary)] max-w-md truncate" title={a.reason}>{a.reason || '—'}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-[var(--text-dim)]">No activations recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
