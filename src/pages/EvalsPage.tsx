import { useDashboard } from '../contexts/DashboardContext.tsx'
import { EvalResults } from '../components/EvalResults.tsx'
import { IterationTimeline } from '../components/IterationTimeline.tsx'

export default function EvalsPage() {
  const { state } = useDashboard()

  return (
    <div className="dashboard-content">
      <section className="lower-intelligence-deck" aria-label="Evaluations and iterations">
        <div className="deck-hero">
          <div>
            <p className="deck-eyebrow">Review</p>
            <h2>Eval results & iteration history</h2>
            <p>Review evaluation results and recent iteration history.</p>
          </div>
        </div>
        <div className="deck-grid deck-grid-review">
          <div className="deck-primary-column">
            <EvalResults results={state.eval_results} runLabel={state.eval_run_label} />
          </div>
        </div>
        <IterationTimeline iterations={state.recent_iterations} />
      </section>
    </div>
  )
}
