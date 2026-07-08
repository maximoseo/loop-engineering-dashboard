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
    task_success: 'Task success', accuracy: 'Accuracy', user_alignment: 'Alignment',
    tool_quality: 'Tool quality', efficiency: 'Efficiency', safety: 'Safety',
    validation: 'Validation', memory_learning: 'Memory', total: 'Total',
  }

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    const idx = Math.round(pct * (data.length - 1))
    if (idx >= 0 && idx < data.length) setHoverIdx(idx)
  }

  return (
    <section className="premium-panel score-panel animate-fade-in delay-2" aria-label="Score trend and breakdown">
      <div className="premium-panel-core">
        <div className="panel-heading-row">
          <div>
            <p className="panel-kicker">score trend</p>
            <h3>Quality trajectory</h3>
            <span>Last {trend.length} scored task{trend.length === 1 ? '' : 's'} with weighted rubric breakdown.</span>
          </div>
          <div className="score-orb" style={{ color: scoreColor }}>
            <strong>{lastScore.total}</strong>
            <span>/100</span>
          </div>
        </div>

        <div className="score-chart-frame">
          <svg
            viewBox={`0 0 ${w} ${h}`}
            className="score-chart-svg"
            preserveAspectRatio="none"
            role="img"
            aria-label={`Score trend over the last ${trend.length} scored tasks`}
            onMouseMove={handleMove}
            onMouseLeave={() => setHoverIdx(null)}
          >
            <defs>
              <linearGradient id="scoreArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.22" />
                <stop offset="60%" stopColor="#8b5cf6" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="scoreLine" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#a78bfa" />
                <stop offset="55%" stopColor="#22d3ee" />
                <stop offset="100%" stopColor={scoreColor} />
              </linearGradient>
            </defs>

            {[25, 50, 75].map((y) => (
              <line key={y} x1="0" y1={h - (y / maxScore) * h} x2={w} y2={h - (y / maxScore) * h} stroke="rgba(148,163,184,0.12)" strokeWidth="0.18" strokeDasharray="0.7 0.7" />
            ))}
            <polygon points={areaPoints} fill="url(#scoreArea)" />
            <polyline points={linePoints} fill="none" stroke="url(#scoreLine)" strokeWidth="0.72" strokeLinejoin="round" strokeLinecap="round" />

            {hoverIdx !== null && hoverIdx < data.length && (
              <>
                <line x1={(hoverIdx / (data.length - 1)) * w} y1="0" x2={(hoverIdx / (data.length - 1)) * w} y2={h} stroke="rgba(226,232,240,0.26)" strokeWidth="0.2" />
                <circle cx={(hoverIdx / (data.length - 1)) * w} cy={h - (data[hoverIdx] / maxScore) * h} r="1.25" fill="#e2e8f0" stroke="#050814" strokeWidth="0.3" />
              </>
            )}
            {trend.length > 0 && <circle cx={w} cy={h - (trend[trend.length - 1] / maxScore) * h} r="1.15" fill={scoreColor} stroke="#050814" strokeWidth="0.25" />}
          </svg>

          {hoverIdx !== null && hoverIdx < data.length && (
            <div className="score-tooltip" style={{ left: `${(hoverIdx / (data.length - 1)) * 100}%`, top: `${h - (data[hoverIdx] / maxScore) * h}%`, color: data[hoverIdx] >= 70 ? '#22d3ee' : data[hoverIdx] >= 50 ? '#fbbf24' : '#f87171' }}>
              {data[hoverIdx]}
            </div>
          )}
        </div>

        <div className="score-axis-row">
          <span>0</span>
          <span>live scoring history</span>
          <span>100</span>
        </div>

        <div className="score-breakdown-grid">
          {(Object.keys(breakdownLabels) as (keyof ScoreBreakdown)[])
            .filter(k => k !== 'total')
            .map(key => {
              const maxMap: Record<keyof ScoreBreakdown, number> = { task_success: 30, accuracy: 15, user_alignment: 15, tool_quality: 10, efficiency: 10, safety: 10, validation: 5, memory_learning: 5, total: 100 }
              const max = maxMap[key]
              const val = lastScore[key]
              const pct = (val / max) * 100
              const color = pct >= 80 ? '#22d3ee' : pct >= 60 ? '#fbbf24' : '#f87171'
              return (
                <div key={key} className="score-breakdown-item">
                  <div>
                    <span>{breakdownLabels[key]}</span>
                    <strong style={{ color }}>{val}/{max}</strong>
                  </div>
                  <div className="score-breakdown-track"><i style={{ width: `${pct}%`, background: color }} /></div>
                </div>
              )
            })}
        </div>
      </div>
    </section>
  )
}
