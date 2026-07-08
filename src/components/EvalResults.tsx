import type { EvalResult, EvalStatus } from '../types.ts'

interface Props {
  results: EvalResult[]
  runLabel?: string
}

const statusConfig: Record<EvalStatus, { color: string; label: string }> = {
  pass: { color: '#22d3ee', label: 'Pass' },
  warn: { color: '#fbbf24', label: 'Warn' },
  fail: { color: '#f87171', label: 'Fail' },
}

const trendIcon = { up: '↑', down: '↓', stable: '→' }
const trendColor = { up: '#22d3ee', down: '#f87171', stable: '#71717a' }

export function EvalResults({ results, runLabel }: Props) {
  const passCount = results.filter(r => r.status === 'pass').length
  const warnCount = results.filter(r => r.status === 'warn').length
  const failCount = results.filter(r => r.status === 'fail').length
  const avgScore = results.length
    ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
    : 0

  return (
    <section id="evals" className="premium-panel eval-panel h-full animate-fade-in delay-3" aria-label="Evaluation results">
      <div className="premium-panel-core">
      <div className="panel-heading-row compact mb-5">
        <div>
          <p className="panel-kicker">eval health</p>
          <h3>Eval results</h3>
          <span>Pass/warn/fail status for the latest evaluation run.</span>
        </div>
        {runLabel && (
          <span className="text-[10px] px-2 py-1 rounded-lg font-mono" style={{ background: 'rgba(139,92,246,0.12)', color: '#a78bfa' }}>
            {runLabel}
          </span>
        )}
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-4 mb-5 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: '#22d3ee' }} />
          <span className="text-[var(--text-secondary)] font-mono">{passCount} pass</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: '#fbbf24' }} />
          <span className="text-[var(--text-secondary)] font-mono">{warnCount} warn</span>
        </div>
        {failCount > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: '#f87171' }} />
            <span className="text-[var(--text-secondary)] font-mono">{failCount} fail</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider">Avg</span>
          <span className="text-lg font-bold font-mono" style={{ color: avgScore >= 80 ? '#22d3ee' : avgScore >= 60 ? '#fbbf24' : '#f87171' }}>
            {avgScore}
          </span>
        </div>
      </div>

      <div className="space-y-2.5">
        {results.length === 0 ? (
          <p className="text-sm text-[var(--text-dim)] text-center py-8">No eval results yet</p>
        ) : (
          results.map((r) => {
            const sc = statusConfig[r.status]
            return (
              <div key={r.name} className="group flex items-center gap-3 py-1.5 transition-all">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: sc.color, boxShadow: `0 0 6px ${sc.color}60` }} />
                <span className="text-sm flex-1 truncate text-[var(--text-secondary)] group-hover:text-[var(--text)] transition-colors">{r.name}</span>
                <span className="text-xs font-mono shrink-0" style={{ color: trendColor[r.trend] }}>{trendIcon[r.trend]}</span>
                <span className="text-sm font-bold font-mono shrink-0 w-8 text-right" style={{ color: sc.color }}>{r.score}</span>
                <div className="w-20 sm:w-28 h-1.5 rounded-full overflow-hidden shrink-0" style={{ background: 'rgba(139,92,246,0.08)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${r.score}%`, background: sc.color, boxShadow: `0 0 4px ${sc.color}50` }}
                  />
                </div>
              </div>
            )
          })
        )}
      </div>
      </div>
    </section>
  )
}
