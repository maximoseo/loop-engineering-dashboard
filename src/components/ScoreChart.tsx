import type { ScoreBreakdown } from '../types.ts'

interface Props {
  trend: number[]
  lastScore: ScoreBreakdown
}

export function ScoreChart({ trend, lastScore }: Props) {
  const maxScore = 100
  const width = 100
  const height = 40
  const points = trend.map((score, i) => {
    const x = (i / (trend.length - 1)) * width
    const y = height - (score / maxScore) * height
    return `${x},${y}`
  }).join(' ')

  const scoreColor = lastScore.total >= 85 ? 'var(--success)' : lastScore.total >= 70 ? 'var(--warning)' : 'var(--error)'

  const breakdownLabels: Record<keyof ScoreBreakdown, string> = {
    task_success: 'Task Success',
    accuracy: 'Accuracy',
    user_alignment: 'Alignment',
    tool_quality: 'Tool Quality',
    efficiency: 'Efficiency',
    safety: 'Safety',
    validation: 'Validation',
    memory_learning: 'Memory',
    total: 'Total',
  }

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">Score Trend</h2>
        <span className="text-2xl font-bold" style={{ color: scoreColor }}>{lastScore.total}<span className="text-sm text-[var(--text-muted)]">/100</span></span>
      </div>

      {/* SVG Chart */}
      <div className="relative mb-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height: '120px' }}>
          {/* Grid lines */}
          {[25, 50, 75].map((y) => (
            <line key={y} x1="0" y1={height - (y / maxScore) * height} x2={width} y2={height - (y / maxScore) * height} stroke="var(--border)" strokeWidth="0.2" />
          ))}
          {/* Area */}
          <polygon points={`0,${height} ${points} ${width},${height}`} fill="var(--accent)" opacity="0.1" />
          {/* Line */}
          <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="0.8" strokeLinejoin="round" strokeLinecap="round" />
          {/* Last point */}
          {trend.length > 0 && (
            <circle
              cx={width}
              cy={height - (trend[trend.length - 1] / maxScore) * height}
              r="1.5"
              fill={scoreColor}
            />
          )}
        </svg>
      </div>

      {/* Score Breakdown */}
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(breakdownLabels) as (keyof ScoreBreakdown)[])
          .filter(k => k !== 'total')
          .map(key => {
            const maxMap: Record<keyof ScoreBreakdown, number> = { task_success: 30, accuracy: 15, user_alignment: 15, tool_quality: 10, efficiency: 10, safety: 10, validation: 5, memory_learning: 5, total: 100 }
            const max = maxMap[key]
            const val = lastScore[key]
            const pct = (val / max) * 100
            return (
              <div key={key} className="text-center">
                <div className="text-xs text-[var(--text-muted)] mb-1">{breakdownLabels[key]}</div>
                <div className="text-sm font-semibold" style={{ color: pct >= 80 ? 'var(--success)' : pct >= 60 ? 'var(--warning)' : 'var(--error)' }}>
                  {val}/{max}
                </div>
                <div className="h-1 bg-[var(--border)] rounded-full mt-1 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 80 ? 'var(--success)' : pct >= 60 ? 'var(--warning)' : 'var(--error)' }} />
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
