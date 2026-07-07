import { useState, useEffect, useCallback, useRef } from 'react'
import type { LoopState } from './types.ts'
import { mockLoopState } from './data/mockData.ts'
import { fetchLoopState } from './data/liveData.ts'
import { Sidebar } from './components/Sidebar.tsx'
import { HeroPhase } from './components/HeroPhase.tsx'
import { PhaseTimeline } from './components/PhaseTimeline.tsx'
import { MetricsSummary } from './components/MetricsSummary.tsx'
import { ScoreChart } from './components/ScoreChart.tsx'
import { ImprovementFeed } from './components/ImprovementFeed.tsx'
import { EvalResults } from './components/EvalResults.tsx'
import { IterationTimeline } from './components/IterationTimeline.tsx'
import { FailureLibrary } from './components/FailureLibrary.tsx'
import { OptimizationBacklog } from './components/OptimizationBacklog.tsx'

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

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text)]">
      <Sidebar
        isRunning={state.is_loop_running}
        live={live}
        lastUpdated={lastUpdated}
        elapsed={elapsed}
        refreshing={refreshing}
        onRefresh={() => void load(true)}
      />

      {/* Main content */}
      <main className="lg:ml-60 relative z-10">
        <div className="px-3 py-4 sm:px-5 md:px-8 md:py-6 lg:px-10 lg:py-8 max-w-[1600px] mx-auto space-y-4 md:space-y-6">

          {/* Hero */}
          <HeroPhase
            phases={state.phases}
            currentPhase={state.current_phase}
            isRunning={state.is_loop_running}
            avgScore={state.avg_score_7d}
            totalIterations={state.total_iterations}
          />

          {/* Metrics */}
          <MetricsSummary
            avgScore={state.avg_score_7d}
            totalIterations={state.total_iterations}
            activated={state.improvements_activated}
            rolledBack={state.improvements_rolled_back}
            scoreTrend={state.score_trend}
          />

          {/* Phase Timeline + Score Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <PhaseTimeline phases={state.phases} currentPhase={state.current_phase} />
            <ScoreChart trend={state.score_trend} lastScore={state.last_score} />
          </div>

          {/* Improvements + Evals */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            <div className="lg:col-span-2">
              <ImprovementFeed improvements={state.recent_improvements} />
            </div>
            <div className="lg:col-span-1">
              <EvalResults results={state.eval_results} runLabel={state.eval_run_label} />
            </div>
          </div>

          {/* Iteration Timeline */}
          <IterationTimeline iterations={state.recent_iterations} />

          {/* Failures + Backlog */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <FailureLibrary failures={state.failure_library} />
            <OptimizationBacklog backlog={state.optimization_backlog} />
          </div>

          {/* Footer */}
          <footer className="pt-6 pb-2 text-center text-xs text-[var(--text-dim)]">
            <p>Loop Engineering Dashboard · Maximo SEO · <a href="https://github.com/maximoseo/loop-engineering-dashboard" className="text-[var(--accent-bright)] hover:underline">GitHub</a></p>
          </footer>
        </div>
      </main>
    </div>
  )
}
