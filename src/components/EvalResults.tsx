import type { EvalResult, EvalStatus } from '../types.ts'

interface Props {
  results: EvalResult[]
  runLabel?: string
}

const statusConfig: Record<EvalStatus, { color: string; icon: string }> = {
  pass: { color: 'var(--success)', icon: '✅' },
  warn: { color: 'var(--warning)', icon: '⚠️' },
  fail: { color: 'var(--error)', icon: '❌' },
}

const trendIcon = { up: '↗', down: '↘', stable: '→' }
const trendColor = { up: 'var(--success)', down: 'var(--error)', stable: 'var(--text-muted)' }

export function EvalResults({ results, runLabel }: Props) {
  const passCount = results.filter(r => r.status === 'pass').length
  const warnCount = results.filter(r => r.status === 'warn').length
  const failCount = results.filter(r => r.status === 'fail').length
  const avgScore = results.length
    ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
    : 0

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 h-full">
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">Eval Results</h2>
        {runLabel && (
          <span className="text-xs px-2 py-1 rounded bg-[var(--accent)]/15 text-[var(--accent)]" title="Which regression eval run these scores come from">
            {runLabel}
          </span>
        )}
      </div>

      <div className="flex gap-3 mb-4 text-xs">
        <span className="text-[var(--success)]">✅ {passCount} pass</span>
        <span className="text-[var(--warning)]">⚠️ {warnCount} warn</span>
        {failCount > 0 && <span className="text-[var(--error)]">❌ {failCount} fail</span>}
        <span className="text-[var(--text-muted)] ml-auto">Avg: {avgScore}/100</span>
      </div>

      <div className="space-y-2">
        {results.length === 0 ? (
          <p className="text-sm text-[var(--text-dim)] text-center py-4">No eval results yet</p>
        ) : (
          results.map((r) => {
            const sc = statusConfig[r.status]
            return (
              <div key={r.name} className="flex items-center gap-2">
                <span className="text-sm shrink-0">{sc.icon}</span>
                <span className="text-sm flex-1 truncate">{r.name}</span>
                <span className="text-xs shrink-0" style={{ color: trendColor[r.trend] }}>{trendIcon[r.trend]}</span>
                <span className="text-sm font-semibold shrink-0" style={{ color: sc.color }}>{r.score}</span>
                <div className="w-12 sm:w-16 h-1.5 bg-[var(--border)] rounded-full overflow-hidden shrink-0">
                  <div className="h-full rounded-full" style={{ width: `${r.score}%`, background: sc.color }} />
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
