import { useDashboard } from '../contexts/DashboardContext.tsx'
import { ImprovementFeed } from '../components/ImprovementFeed.tsx'

export default function ProposalsPage() {
  const { state } = useDashboard()

  return (
    <div className="dashboard-content">
      <section className="lower-intelligence-deck" aria-label="Proposals">
        <div className="deck-hero">
          <div>
            <p className="deck-eyebrow">Review center</p>
            <h2>Improvement proposals</h2>
            <p>Review and manage improvement proposals across memory, skills, prompts, config, and MCP tooling.</p>
          </div>
        </div>
        <div className="deck-grid deck-grid-review">
          <div className="deck-primary-column">
            <ImprovementFeed improvements={state.recent_improvements} />
          </div>
        </div>
      </section>
    </div>
  )
}
