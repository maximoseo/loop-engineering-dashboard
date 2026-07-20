import { AnalyticsPage as AnalyticsView } from '../components/AnalyticsPage.tsx'
import { useDashboard } from '../contexts/DashboardContext.tsx'

export default function AnalyticsPage() {
  const { state, health } = useDashboard()
  return (
    <div className="dashboard-content">
      <section className="lower-intelligence-deck" aria-label="Analytics">
        <div className="deck-hero">
          <div>
            <p className="deck-eyebrow">Analytics</p>
            <h2>Score &amp; failure analytics</h2>
            <p>Rubric-dimension trends, score trajectory, and failure distribution from live evaluation data.</p>
          </div>
        </div>
        <AnalyticsView
          state={state}
          health={health}
          scores={state.score_history ?? []}
          failures={state.failure_library}
        />
      </section>
    </div>
  )
}
