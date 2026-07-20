import { useMemo } from 'react'
import { ScoreTrend, RubricBreakdown, FailureHistogram } from './charts/Charts'
import type { LoopState, DataHealth, ScoreBreakdown, FailurePattern } from '../types'

interface AnalyticsPageProps {
  state: LoopState
  health: DataHealth
  scores: ScoreBreakdown[]
  failures: FailurePattern[]
}

export function AnalyticsPage({ state, scores, failures }: AnalyticsPageProps) {
  const latestBreakdown = useMemo((): Partial<Record<string, number>> => {
    if (scores.length === 0) return {}
    const s = scores[scores.length - 1]
    // ScoreBreakdown has known keys; cast through unknown for Record compatibility
    return s ? (s as unknown as Record<string, number>) : {}
  }, [scores])

  const avgScore = useMemo(() => {
    if (scores.length === 0) return 0
    return Math.round(scores.reduce((sum, s) => sum + s.total, 0) / scores.length)
  }, [scores])

  const failureData = useMemo(() =>
    failures.map(f => ({ created_at: f.last_seen, severity: f.category === 'critical' ? 'critical' : f.category === 'high' ? 'high' : f.category === 'medium' ? 'medium' : 'low' })),
    [failures]
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
          <div className="text-xs text-[var(--text-secondary)] uppercase tracking-wider">Avg Score</div>
          <div className="text-3xl font-bold text-[var(--text)] mt-1">{avgScore}<span className="text-sm text-[var(--text-secondary)]">/100</span></div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
          <div className="text-xs text-[var(--text-secondary)] uppercase tracking-wider">Iterations</div>
          <div className="text-3xl font-bold text-[var(--text)] mt-1">{state.total_iterations}</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
          <div className="text-xs text-[var(--text-secondary)] uppercase tracking-wider">Activated</div>
          <div className="text-3xl font-bold text-[var(--text)] mt-1">{state.improvements_activated}</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
          <div className="text-xs text-[var(--text-secondary)] uppercase tracking-wider">Rollbacks</div>
          <div className="text-3xl font-bold text-[var(--accent)] mt-1">{state.improvements_rolled_back}</div>
        </div>
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
        <h3 className="text-sm font-semibold text-[var(--text)] mb-3">Score Trend (30 days)</h3>
        <ScoreTrend scores={scores.map(s => ({ total: s.total, task_id: '', created_at: new Date().toISOString(), breakdown: { ...s } }))} days={30} height={220} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-[var(--text)] mb-3">Latest Rubric</h3>
          <RubricBreakdown breakdown={latestBreakdown} height={200} />
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-[var(--text)] mb-3">Failures per Week</h3>
          <FailureHistogram failures={failureData} weeks={12} height={200} />
        </div>
      </div>
    </div>
  )
}
