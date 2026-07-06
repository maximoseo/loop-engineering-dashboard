import { useState, useEffect } from 'react'
import type { LoopState } from './types.ts'
import { mockLoopState } from './data/mockData.ts'
import { MetricsSummary } from './components/MetricsSummary.tsx'
import { LoopVisualization } from './components/LoopVisualization.tsx'
import { ScoreChart } from './components/ScoreChart.tsx'
import { IterationTimeline } from './components/IterationTimeline.tsx'
import { ImprovementFeed } from './components/ImprovementFeed.tsx'
import { FailureLibrary } from './components/FailureLibrary.tsx'
import { OptimizationBacklog } from './components/OptimizationBacklog.tsx'
import { EvalResults } from './components/EvalResults.tsx'
import { LoopControlPanel } from './components/LoopControlPanel.tsx'

export default function App() {
  const [state] = useState<LoopState>(mockLoopState)
  const [time, setTime] = useState(new Date().toISOString())

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date().toISOString()), 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text)] p-4 md:p-6 lg:p-8">
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--accent)]/20 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                <circle cx="12" cy="12" r="8" strokeDasharray="3 3" />
                <circle cx="12" cy="12" r="3" fill="var(--accent)" />
                <circle cx="12" cy="4" r="1.5" fill="var(--success)" />
                <circle cx="20" cy="12" r="1.5" fill="var(--warning)" />
                <circle cx="12" cy="20" r="1.5" fill="var(--error)" />
                <circle cx="4" cy="12" r="1.5" fill="var(--info)" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold">Loop Engineering Dashboard</h1>
              <p className="text-xs text-[var(--text-muted)]">Self-improving agent loop system</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-[var(--text-muted)] font-mono">{time}</span>
            <LoopControlPanel isRunning={state.is_loop_running} />
          </div>
        </div>
      </header>

      {/* Metric Cards */}
      <MetricsSummary
        avgScore={state.avg_score_7d}
        totalIterations={state.total_iterations}
        activated={state.improvements_activated}
        rolledBack={state.improvements_rolled_back}
      />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        {/* Loop Visualization */}
        <div className="lg:col-span-1">
          <LoopVisualization phases={state.phases} currentPhase={state.current_phase} />
        </div>

        {/* Score Trend */}
        <div className="lg:col-span-1">
          <ScoreChart trend={state.score_trend} lastScore={state.last_score} />
        </div>
      </div>

      {/* Improvements + Eval Results */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <ImprovementFeed improvements={state.recent_improvements} />
        </div>
        <div className="lg:col-span-1">
          <EvalResults results={state.eval_results} />
        </div>
      </div>

      {/* Iteration Timeline */}
      <div className="mt-4">
        <IterationTimeline iterations={state.recent_iterations} />
      </div>

      {/* Failure Library + Optimization Backlog */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <FailureLibrary failures={state.failure_library} />
        <OptimizationBacklog backlog={state.optimization_backlog} />
      </div>

      {/* Footer */}
      <footer className="mt-8 pt-4 border-t border-[var(--border)] text-center text-xs text-[var(--text-dim)]">
        <p>Loop Engineering Dashboard · Maximo SEO · <a href="https://github.com/maximoseo/loop-engineering-dashboard" className="text-[var(--accent)] hover:underline">GitHub</a></p>
      </footer>
    </div>
  )
}
