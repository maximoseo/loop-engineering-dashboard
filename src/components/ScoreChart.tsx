import { useState } from 'react'
import type { ScoreBreakdown } from '../types.ts'

interface Props {
  trend: number[]
  lastScore: ScoreBreakdown
}

export function ScoreChart({ trend, lastScore }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const maxScore = 100
  const w = 100
  const h = 50
  const data = trend.length === 1 ? [trend[0], trend[0]] : trend
  const points = data.map((score, i, arr) => {
    const x = (i / (arr.length - 1)) * w
    const y = h - (score / maxScore) * h
    return `${x},${y}`
  })
  const linePoints = points.join(' ')
  const areaPoints = `0,${h} ${linePoints} ${w},${h}`

  const scoreColor = lastScore.total >= 85 ? '#22d3ee' : lastScore.total >= 70 ? '#fbbf24' : '#f87171'

  const breakdownLabels: Record<keyof ScoreBreakdown, string> = {
    task_success: 'Task Success', accuracy: 'Accuracy', user_alignment: 'Alignment',
    tool_quality: 'Tool Quality', efficiency: 'Efficiency', safety: 'Safety',
    validation: 'Validation', memory_learning: 'Memory', total: 'Total',
  }

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    const idx = Math.round(pct * (data.length - 1))
    if (idx >= 0 && idx < data.length) setHoverIdx(idx)
  }

  return (
    <div className="rounded-2xl glass gradient-border p-5 md:p-6 h-full animate-fade-in delay-2">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Score Trend</h3>
        <div className="text-right">
          <span className="text-2xl md:text-3xl font-bold font-mono" style={{ color: scoreColor }}>
            {lastScore.total}
          </span>
          <span className="text-sm text-[var(--text-muted)] font-mono">/100</span>
        </div>
      </div>

      {/* Chart */}
      <div className="relative mb-2">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="w-full"
          preserveAspectRatio="none"
          style={{ height: '220px' }}
          role="img"
          aria-label={`Score trend over the last ${trend.length} scored tasks`}
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id="scoreArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="scoreLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[25, 50, 75].map((y) => (
            <line key={y} x1="0" y1={h - (y / maxScore) * h} x2={w} y2={h - (y / maxScore) * h} stroke="rgba(139,92,246,0.08)" strokeWidth="0.15" strokeDasharray="0.5 0.5" />
          ))}

          {/* Area fill */}
          <polygon points={areaPoints} fill="url(#scoreArea)" />

          {/* Line */}
          <polyline points={linePoints} fill="none" stroke="url(#scoreLine)" strokeWidth="0.6" strokeLinejoin="round" strokeLinecap="round" />

          {/* Hover indicator */}
          {hoverIdx !== null && hoverIdx < data.length && (
            <>
              <line
                x1={(hoverIdx / (data.length - 1)) * w}
                y1="0"
                x2={(hoverIdx / (data.length - 1)) * w}
                y2={h}
                stroke="rgba(139,92,246,0.3)"
                strokeWidth="0.2"
              />
              <circle
                cx={(hoverIdx / (data.length - 1)) * w}
                cy={h - (data[hoverIdx] / maxScore) * h}
                r="1.2"
                fill="#a78bfa"
                stroke="#060614"
                strokeWidth="0.3"
              />
            </>
          )}

          {/* Last point */}
          {trend.length > 0 && (
            <circle
              cx={w}
              cy={h - (trend[trend.length - 1] / maxScore) * h}
              r="1"
              fill={scoreColor}
              stroke="#060614"
              strokeWidth="0.2"
            />
          )}
        </svg>

        {/* Hover tooltip */}
        {hoverIdx !== null && hoverIdx < data.length && (
          <div
            className="absolute pointer-events-none px-2 py-1 rounded-lg glass text-xs font-mono z-10"
            style={{
              left: `${(hoverIdx / (data.length - 1)) * 100}%`,
              top: `${h - (data[hoverIdx] / maxScore) * h}%`,
              transform: 'translate(-50%, -135%)',
              color: data[hoverIdx] >= 70 ? '#22d3ee' : data[hoverIdx] >= 50 ? '#fbbf24' : '#f87171',
            }}
          >
            {data[hoverIdx]}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] text-[var(--text-dim)] font-mono">0</span>
        <span className="text-[10px] text-[var(--text-dim)]">last {trend.length} scored task{trend.length === 1 ? '' : 's'}</span>
        <span className="text-[10px] text-[var(--text-dim)] font-mono">100</span>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(Object.keys(breakdownLabels) as (keyof ScoreBreakdown)[])
          .filter(k => k !== 'total')
          .map(key => {
            const maxMap: Record<keyof ScoreBreakdown, number> = { task_success: 30, accuracy: 15, user_alignment: 15, tool_quality: 10, efficiency: 10, safety: 10, validation: 5, memory_learning: 5, total: 100 }
            const max = maxMap[key]
            const val = lastScore[key]
            const pct = (val / max) * 100
            const color = pct >= 80 ? '#22d3ee' : pct >= 60 ? '#fbbf24' : '#f87171'
            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[var(--text-muted)]">{breakdownLabels[key]}</span>
                  <span className="text-xs font-mono font-semibold" style={{ color }}>{val}/{max}</span>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(139,92,246,0.1)' }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}50` }} />
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
