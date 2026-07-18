import { useDashboard } from '../contexts/DashboardContext.tsx'
import { ProjectOrchestrator } from '../components/ProjectOrchestrator.tsx'
import { OperatorCommandCenter } from '../components/OperatorCommandCenter.tsx'

export default function OrchestratorPage() {
  const { state, health, live, elapsed } = useDashboard()

  return (
    <div className="dashboard-content">
      {/* Multi-agent orchestration cockpit */}
      <ProjectOrchestrator />

      {/* Operator today/review/health center */}
      <OperatorCommandCenter
        state={state}
        health={health}
        live={live}
        elapsed={elapsed}
      />
    </div>
  )
}
