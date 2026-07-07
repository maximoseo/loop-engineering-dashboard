import { useState, useEffect, useCallback, useRef } from 'react'
import type { LoopState } from './types.ts'
import { mockLoopState } from './data/mockData.ts'
import { fetchLoopState } from './data/liveData.ts'
import { MetricsSummary } from './components/MetricsSummary.tsx'
import { LoopVisualization } from './components/LoopVisualization.tsx'
import { ScoreChart } from './components/ScoreChart.tsx'
import { IterationTimeline } from './components/IterationTimeline.tsx'
import { ImprovementFeed } from './components/ImprovementFeed.tsx'
import { FailureLibrary } from './components/FailureLibrary.tsx'
import { OptimizationBacklog } from './components/OptimizationBacklog.tsx'
import { EvalResults } from './components/EvalResults.tsx'
import { LoopControlPanel } from './components/LoopControlPanel.tsx'

const POLL_MS = 30_000

export default function App() {
  const [state, setState] = useState<LoopState>(mockLoopState)
  const [live, setLive] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const loadingRef = useRef(false)

  const load = useCallback(async (manual = false) => {
    if (loadingRef.current) return
    loadingRef.current = true
    if (manual) setRefreshing(true)
    try {
      const result = await fetchLoopState()
      setState(result.state)
      setLive(result.live)
      setLastUpdated(new Date())
    } catch {
      setLive(false)
    } finally {
      loadingRef.current = false
      if (manual) setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const interval = setInterval(() => void load(), POLL_MS)
    return () => clearInterval(interval)
  }, [load])

  useEffect(() => {
    if (!lastUpdated) return
    const tick = setInterval(() => {
      setElapsed(Math.floor((Date.now() - lastUpdated.getTime()) / 1000))
    }, 1000)
    return () => clearInterval(tick)
  }, [lastUpdated])

  const formatElapsed = (s: number) => {
    if (s < 60) return `${s}s ago`
    if (s < 3600) return `${Math.floor(s / 60)}m ago`
    return `${Math.floor(s / 3600)}h ago`
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text)] p-3 sm:p-4 md:p-6 lg:p-8">
      {/* Header */}
      <header className="mb-4 md:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 shrink-0 rounded-lg bg-[var(--accent)]/20 flex items-center justify-center">
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
              <h1 className="text-base sm:text-lg md:text-xl font-bold">Loop Engineering Dashboard</h1>
              <p className="text-xs text-[var(--text-muted)]">Self-improving agent loop system</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${live ? 'bg-[var(--success)]/20 text-[var(--success)]' : 'bg-[var(--warning)]/20 text-[var(--warning)]'}`}
              title={live ? 'Showing live data from Supabase' : 'No live data yet — showing demo data'}
            >
              {live ? 'LIVE' : 'DEMO'}
            </span>
            <LoopControlPanel isRunning={state.is_loop_running} live={live} />
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mt-3 sm:mt-4">
        {/* Loop Visualization */}
        <div className="lg:col-span-1">
          <LoopVisualization phases={state.phases} currentPhase={state.current_phase} isRunning={state.is_loop_running} />
        </div>

        {/* Score Trend */}
        <div className="lg:col-span-1">
          <ScoreChart trend={state.score_trend} lastScore={state.last_score} />
        </div>
      </div>

      {/* Improvements + Eval Results */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 mt-3 sm:mt-4">
        <div className="lg:col-span-2">
          <ImprovementFeed improvements={state.recent_improvements} />
        </div>
        <div className="lg:col-span-1">
          <EvalResults results={state.eval_results} runLabel={state.eval_run_label} />
        </div>
      </div>

      {/* Iteration Timeline */}
      <div className="mt-3 sm:mt-4">
        <IterationTimeline iterations={state.recent_iterations} />
      </div>

      {/* Failure Library + Optimization Backlog */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mt-3 sm:mt-4">
        <FailureLibrary failures={state.failure_library} />
        <OptimizationBacklog backlog={state.optimization_backlog} />
      </div>

      {/* Footer */}
      <footer className="mt-6 md:mt-8 pt-4 border-t border-[var(--border)]">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[var(--text-dim)]">
          <p>Loop Engineering Dashboard · Maximo SEO · <a href="https://github.com/maximoseo/loop-engineering-dashboard" className="text-[var(--accent)] hover:underline">GitHub</a></p>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-[var(--text-muted)]">Data updated {formatElapsed(elapsed)}</span>
            )}
            <button
              onClick={() => void load(true)}
              disabled={refreshing}
              className="px-2 py-1 rounded text-xs border border-[var(--border)] hover:border-[var(--accent)] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors disabled:opacity-50"
              aria-label="Refresh data manually"
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}
