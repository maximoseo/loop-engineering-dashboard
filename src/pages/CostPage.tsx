import { useDashboard } from '../contexts/DashboardContext.tsx'
import { exportCsv } from '../lib/exportCsv.ts'

const fmt = (n: number) => n.toLocaleString()
const usd = (n: number) => `$${n.toFixed(4)}`

export default function CostPage() {
  const { state } = useDashboard()
  const cost = state.cost
  const byModel = cost?.by_model ?? []

  return (
    <div className="dashboard-content">
      <section className="lower-intelligence-deck" aria-label="Cost analytics">
        <div className="deck-hero">
          <div>
            <p className="deck-eyebrow">Spend</p>
            <h2>Cost &amp; token analytics</h2>
            <p>Token usage and estimated USD spend across orchestrator runs, grouped by model.</p>
          </div>
          <button className="ghost-button" onClick={() => exportCsv('loop-cost-by-model.csv', byModel)} disabled={!byModel.length}>
            Export CSV
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card"><p className="eyebrow">Total cost</p><div className="text-3xl font-bold text-[var(--accent-bright)]">{usd(cost?.total_cost_usd ?? 0)}</div></div>
          <div className="glass-card"><p className="eyebrow">Input tokens</p><div className="text-3xl font-bold text-[var(--text)]">{fmt(cost?.total_input_tokens ?? 0)}</div></div>
          <div className="glass-card"><p className="eyebrow">Output tokens</p><div className="text-3xl font-bold text-[var(--text)]">{fmt(cost?.total_output_tokens ?? 0)}</div></div>
          <div className="glass-card"><p className="eyebrow">Cost events</p><div className="text-3xl font-bold text-[var(--text)]">{fmt(cost?.events ?? 0)}</div></div>
        </div>
        <div className="glass-card" style={{ overflowX: 'auto', marginTop: '1rem' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[var(--text-secondary)]">
                <th className="p-2 font-medium">Model</th>
                <th className="p-2 font-medium text-right">Input</th>
                <th className="p-2 font-medium text-right">Output</th>
                <th className="p-2 font-medium text-right">Cost</th>
                <th className="p-2 font-medium text-right">Events</th>
              </tr>
            </thead>
            <tbody>
              {byModel.map((g) => (
                <tr key={g.key} className="border-b border-[var(--border)]/50">
                  <td className="p-2 font-mono text-xs text-[var(--text)]">{g.key}</td>
                  <td className="p-2 text-right text-[var(--text-secondary)]">{fmt(g.input_tokens)}</td>
                  <td className="p-2 text-right text-[var(--text-secondary)]">{fmt(g.output_tokens)}</td>
                  <td className="p-2 text-right text-[var(--accent-bright)]">{usd(g.cost_usd)}</td>
                  <td className="p-2 text-right text-[var(--text-muted)]">{g.events}</td>
                </tr>
              ))}
              {!byModel.length && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-[var(--text-dim)]">No cost events recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
