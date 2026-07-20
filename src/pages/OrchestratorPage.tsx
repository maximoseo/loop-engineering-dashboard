import { useParams, useNavigate } from 'react-router-dom'
import { useDashboard } from '../contexts/DashboardContext.tsx'
import { ProjectOrchestrator } from '../components/ProjectOrchestrator.tsx'
import { OperatorCommandCenter } from '../components/OperatorCommandCenter.tsx'

export default function OrchestratorPage() {
  const { state, health, live, elapsed } = useDashboard()
  const { runId } = useParams()
  const navigate = useNavigate()

  return (
    <div className="dashboard-content">
      {/* Multi-agent orchestration cockpit */}
      <ProjectOrchestrator
        initialRunId={runId}
        onSelectRun={(id) => navigate(`/orchestrator/${id}`)}
      />

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
