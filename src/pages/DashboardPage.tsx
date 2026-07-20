import { useDashboard } from '../contexts/DashboardContext.tsx'
import { OperationalOverview } from '../components/OperationalOverview.tsx'
import { MetricsSummary } from '../components/MetricsSummary.tsx'
import { PhaseTimeline } from '../components/PhaseTimeline.tsx'
import { ScoreChart } from '../components/ScoreChart.tsx'
import { ProductionStatus } from '../components/ProductionStatus.tsx'
import { ImprovementFeed } from '../components/ImprovementFeed.tsx'
import { EvalResults } from '../components/EvalResults.tsx'
import { IterationTimeline } from '../components/IterationTimeline.tsx'
import { FailureLibrary } from '../components/FailureLibrary.tsx'
import { OptimizationBacklog } from '../components/OptimizationBacklog.tsx'
import { LoopHealthPanel } from '../components/LoopHealthPanel.tsx'
import { PanelBoundary } from '../components/PanelBoundary.tsx'

export default function DashboardPage() {
  const { state, health, live, lastUpdated, elapsed, load } = useDashboard()

  return (
    <div className="dashboard-content">
      {/* Compact operational overview */}
      <OperationalOverview
        state={state}
        health={health}
        live={live}
        elapsed={elapsed}
        onRefresh={() => void load(true)}
      />

      <PanelBoundary label="health panel">
        <LoopHealthPanel state={state} live={live} elapsed={elapsed} />
      </PanelBoundary>

      {/* Lower intelligence deck: data, graphs, history and review */}
      <PanelBoundary label="operations deck">
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
      </PanelBoundary>

      {/* Footer */}
      <footer className="pt-6 pb-2 text-center text-xs text-[var(--text-dim)]">
        <p>Loop Engineering Dashboard · Maximo SEO · <a href="https://github.com/maximoseo/loop-engineering-dashboard" className="text-[var(--accent-bright)] hover:underline">GitHub</a></p>
      </footer>
    </div>
  )
}
