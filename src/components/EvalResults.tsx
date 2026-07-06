import type { EvalResult, EvalStatus } from '../types.ts'

interface Props {
  results: EvalResult[]
}

const statusConfig: Record<EvalStatus, { color: string; icon: string }> = {
  pass: { color: 'var(--success)', icon: '✅' },
  warn: { color: 'var(--warning)', icon: '⚠️' },
  fail: { color: 'var(--error)', icon: '❌' },
}

const trendIcon = { up: '↗', down: '↘', stable: '→' }
const trendColor = { up: 'var(--success)', down: 'var(--error)', stable: 'var(--text-muted)' }

export function EvalResults({ results }: Props) {
  const passCount = results.filter(r => r.status === 'pass').length
  const warnCount = results.filter(r => r.status === 'warn').length
  const failCount = results.filter(r => r.status === 'fail').length
  const avgScore = Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">Eval Results</h2>
        <button className="text-xs px-2 py-1 rounded bg-[var(--accent)]/20 text-[var(--accent)] hover:bg-[var(--accent)]/30 transition-colors">
          Re-run
        </button>
      </div>

      <div className="flex gap-3 mb-4 text-xs">
        <span className="text-[var(--success)]">✅ {passCount} pass</span>
        <span className="text-[var(--warning)]">⚠️ {warnCount} warn</span>
        {failCount > 0 && <span className="text-[var(--error)]">❌ {failCount} fail</span>}
        <span className="text-[var(--text-muted)] ml-auto">Avg: {avgScore}/100</span>
      </div>

      <div className="space-y-2">
        {results.map((r) => {
          const sc = statusConfig[r.status]
          return (
            <div key={r.name} className="flex items-center gap-2">
              <span className="text-sm">{sc.icon}</span>
              <span className="text-sm flex-1">{r.name}</span>
              <span className="text-xs" style={{ color: trendColor[r.trend] }}>{trendIcon[r.trend]}</span>
              <span className="text-sm font-semibold" style={{ color: sc.color }}>{r.score}</span>
              <div className="w-16 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${r.score}%`, background: sc.color }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
