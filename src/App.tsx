import { useState, useEffect, useCallback, useRef } from 'react'
import type { DataHealth, LoopState } from './types.ts'
import { mockLoopState } from './data/mockData.ts'
import { emptyDataHealth } from './data/dataHealth.ts'
import { fetchLoopState } from './data/liveData.ts'
import { Sidebar } from './components/Sidebar.tsx'
import { OperationalOverview } from './components/OperationalOverview.tsx'
import { PhaseTimeline } from './components/PhaseTimeline.tsx'
import { MetricsSummary } from './components/MetricsSummary.tsx'
import { ScoreChart } from './components/ScoreChart.tsx'
import { ImprovementFeed } from './components/ImprovementFeed.tsx'
import { EvalResults } from './components/EvalResults.tsx'
import { IterationTimeline } from './components/IterationTimeline.tsx'
import { FailureLibrary } from './components/FailureLibrary.tsx'
import { OptimizationBacklog } from './components/OptimizationBacklog.tsx'
import { ProductionStatus } from './components/ProductionStatus.tsx'
import { NewLoopTask } from './components/NewLoopTask.tsx'
import { OperatorCommandCenter } from './components/OperatorCommandCenter.tsx'
import { ProjectOrchestrator } from './components/ProjectOrchestrator.tsx'

const POLL_MS = 30_000

export default function App() {
  const [state, setState] = useState<LoopState>(mockLoopState)
  const [health, setHealth] = useState<DataHealth>(() => emptyDataHealth())
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
      setHealth(result.health)
      setLive(result.live)
      setLastUpdated(new Date())
    } catch (error) {
      setLive(false)
      setHealth(emptyDataHealth(error instanceof Error ? error.message : String(error)))
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
      <main className="dashboard-main relative z-10">
        <div className="dashboard-content">

          {/* Primary task command workbench */}
          <NewLoopTask />

          {/* Multi-agent orchestration cockpit */}
          <ProjectOrchestrator />

          {/* Operator today/review/health center */}
          <OperatorCommandCenter
            state={state}
            health={health}
            live={live}
            elapsed={elapsed}
          />

          {/* Compact operational overview */}
          <OperationalOverview
            state={state}
            health={health}
            live={live}
            elapsed={elapsed}
            onRefresh={() => void load(true)}
          />

          {/* Lower intelligence deck: data, graphs, history and review */}
          <section className="lower-intelligence-deck" aria-label="Operations intelligence, graphs and history">
            <div className="deck-hero">
              <div>
                <p className="deck-eyebrow">Operations intelligence</p>
                <h2>Signals, trends, reviews and recovery history</h2>
                <p>Professional monitoring layer for the lower dashboard: live data proof, score movement, proposal review, eval health, recent runs, failure patterns and backlog priorities.</p>
              </div>
              <div className="deck-proof-grid" aria-label="Lower dashboard proof points">
                <span><strong>{state.score_trend.length}</strong> score points</span>
                <span><strong>{state.recent_improvements.length}</strong> proposals</span>
                <span><strong>{state.eval_results.length}</strong> evals</span>
                <span><strong>{state.failure_library.length}</strong> patterns</span>
              </div>
            </div>

            <MetricsSummary
              avgScore={state.avg_score_7d}
              totalIterations={state.total_iterations}
              activated={state.improvements_activated}
              rolledBack={state.improvements_rolled_back}
              scoreTrend={state.score_trend}
            />

            <div className="deck-grid deck-grid-balanced">
              <PhaseTimeline phases={state.phases} currentPhase={state.current_phase} />
              <ScoreChart trend={state.score_trend} lastScore={state.last_score} />
            </div>

            <ProductionStatus
              health={health}
              live={live}
              isRunning={state.is_loop_running}
              lastUpdated={lastUpdated}
              elapsed={elapsed}
              totalIterations={state.total_iterations}
              avgScore={state.avg_score_7d}
              activated={state.improvements_activated}
              rolledBack={state.improvements_rolled_back}
              evalCount={state.eval_results.length}
              backlogCount={state.optimization_backlog.length}
            />

            <div className="deck-grid deck-grid-review">
              <div className="deck-primary-column">
                <ImprovementFeed improvements={state.recent_improvements} />
              </div>
              <div className="deck-side-column">
                <EvalResults results={state.eval_results} runLabel={state.eval_run_label} />
              </div>
            </div>

            <IterationTimeline iterations={state.recent_iterations} />

            <div className="deck-grid deck-grid-balanced">
              <FailureLibrary failures={state.failure_library} />
              <OptimizationBacklog backlog={state.optimization_backlog} />
            </div>
          </section>

          {/* Footer */}
          <footer className="pt-6 pb-2 text-center text-xs text-[var(--text-dim)]">
            <p>Loop Engineering Dashboard · Maximo SEO · <a href="https://github.com/maximoseo/loop-engineering-dashboard" className="text-[var(--accent-bright)] hover:underline">GitHub</a></p>
          </footer>
        </div>
      </main>
    </div>
  )
}
