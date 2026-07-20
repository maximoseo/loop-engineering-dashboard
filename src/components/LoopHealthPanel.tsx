import type { LoopState } from '../types.ts'

interface Alert {
  level: 'critical' | 'warn' | 'info'
  message: string
}

const toneColor: Record<string, string> = { good: '#22d3ee', warn: '#fbbf24', bad: '#f87171', neutral: '#a1a1aa' }
const alertColor: Record<string, string> = { critical: '#f87171', warn: '#fbbf24', info: '#60a5fa' }

export function LoopHealthPanel({ state, live, elapsed }: { state: LoopState; live: boolean; elapsed: number }) {
  const pendingApprovals = state.recent_improvements.filter((p) => p.status === 'pending_approval').length
  const safetyEval = state.eval_results.find((e) => /safety/i.test(e.name))
  const maxFailureFreq = state.failure_library.reduce((m, f) => Math.max(m, f.frequency), 0)
  const evalPass = state.eval_results.filter((e) => e.status === 'pass').length
  const evalTotal = state.eval_results.length

  const alerts: Alert[] = []
  if (!live) alerts.push({ level: 'critical', message: 'Dashboard is showing demo/fallback data, not live Supabase.' })
  if (state.improvements_rolled_back > 0) alerts.push({ level: 'warn', message: `${state.improvements_rolled_back} activation(s) rolled back.` })
  if (safetyEval && safetyEval.score < 80) alerts.push({ level: 'critical', message: `Safety eval below 80 (${safetyEval.score}).` })
  if (pendingApprovals > 0) alerts.push({ level: 'info', message: `${pendingApprovals} proposal(s) awaiting approval.` })
  if (maxFailureFreq >= 3) alerts.push({ level: 'warn', message: `Recurring failure pattern seen ${maxFailureFreq}×.` })
  if (state.avg_score_7d && state.avg_score_7d < 70) alerts.push({ level: 'warn', message: `7-day average score is ${state.avg_score_7d} (below 70).` })

  const cards = [
    { label: 'Data freshness', value: live ? `${elapsed}s ago` : 'Demo', tone: live ? 'good' : 'bad' },
    { label: 'Loop', value: state.is_loop_running ? 'Active' : 'Idle', tone: state.is_loop_running ? 'good' : 'neutral' },
    { label: 'Stability', value: state.improvements_rolled_back === 0 ? 'No rollbacks' : `${state.improvements_rolled_back} rolled back`, tone: state.improvements_rolled_back === 0 ? 'good' : 'warn' },
    { label: 'Eval pass', value: evalTotal ? `${evalPass}/${evalTotal}` : '—', tone: evalTotal && evalPass === evalTotal ? 'good' : 'warn' },
    { label: 'Approvals', value: `${pendingApprovals} pending`, tone: pendingApprovals ? 'warn' : 'good' },
    { label: 'Safety', value: safetyEval ? `${safetyEval.score}` : '—', tone: safetyEval && safetyEval.score >= 80 ? 'good' : safetyEval ? 'bad' : 'neutral' },
  ]

  const hasCritical = alerts.some((a) => a.level === 'critical')

  return (
    <section className="glass-card" aria-label="Loop health and alerts" style={{ marginTop: '1rem' }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="eyebrow">Reliability</p>
          <h3 className="section-header">Loop health &amp; alerts</h3>
        </div>
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full"
          style={{
            background: hasCritical ? 'rgba(248,113,113,0.15)' : alerts.length ? 'rgba(251,191,36,0.15)' : 'rgba(34,211,238,0.15)',
            color: hasCritical ? '#f87171' : alerts.length ? '#fbbf24' : '#22d3ee',
          }}
        >
          {alerts.length ? `${alerts.length} alert${alerts.length > 1 ? 's' : ''}` : 'All clear'}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{c.label}</p>
            <p className="mt-1 text-sm font-semibold" style={{ color: toneColor[c.tone] }}>{c.value}</p>
          </div>
        ))}
      </div>
      {alerts.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {alerts.map((a, i) => (
            <li key={i} className="flex items-center gap-2 text-xs">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: alertColor[a.level] }} />
              <span className="text-[var(--text-secondary)]">{a.message}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
