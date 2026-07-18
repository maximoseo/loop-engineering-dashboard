import { useDashboard } from '../contexts/DashboardContext.tsx'
import { FailureLibrary } from '../components/FailureLibrary.tsx'
import { OptimizationBacklog } from '../components/OptimizationBacklog.tsx'

export default function FailuresPage() {
  const { state } = useDashboard()

  return (
    <div className="dashboard-content">
      <section className="lower-intelligence-deck" aria-label="Failures and backlog">
        <div className="deck-hero">
          <div>
            <p className="deck-eyebrow">History</p>
            <h2>Failure library & optimization backlog</h2>
            <p>Track recurring failure patterns and prioritize optimization items.</p>
          </div>
        </div>
        <div className="deck-grid deck-grid-balanced">
          <FailureLibrary failures={state.failure_library} />
          <OptimizationBacklog backlog={state.optimization_backlog} />
        </div>
      </section>
    </div>
  )
}
