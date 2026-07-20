import { LessonsExplorer } from '../components/LessonsExplorer.tsx'
import { useDashboard } from '../contexts/DashboardContext.tsx'

export default function LessonsPage() {
  const { state } = useDashboard()
  return (
    <div className="dashboard-content">
      <section className="lower-intelligence-deck" aria-label="Lessons">
        <div className="deck-hero">
          <div>
            <p className="deck-eyebrow">Learn</p>
            <h2>Lessons explorer</h2>
            <p>Search and filter every lesson the loop has extracted — preferences, procedures, pitfalls, and optimizations.</p>
          </div>
        </div>
        <LessonsExplorer lessons={state.lessons ?? []} />
      </section>
    </div>
  )
}
