import type {
  AgentAssignment,
  AgentEvent,
  AgentRegistryEntry,
  ModelProfile,
  OrchestratorProject,
  OrchestratorRun,
  RunApproval,
  RunArtifact,
  WorkerHeartbeat,
} from '../types.ts'

export interface OrchestratorState {
  ok: boolean
  projects: OrchestratorProject[]
  runs: OrchestratorRun[]
  assignments: AgentAssignment[]
  events: AgentEvent[]
  agents: AgentRegistryEntry[]
  models: ModelProfile[]
  approvals: RunApproval[]
  artifacts: RunArtifact[]
  heartbeats: WorkerHeartbeat[]
  workerTokenConfigured: boolean
  message?: string
}

export interface CreateRunInput {
  name: string
  objective: string
  contextUrl?: string
  mode: OrchestratorRun['mode']
  constraints?: string[]
  successCriteria?: string[]
  budget?: Record<string, unknown>
}

export async function fetchOrchestratorState(): Promise<OrchestratorState> {
  const response = await fetch('/api/orchestrator')
  if (!response.ok) throw new Error(`Orchestrator status failed: ${response.status}`)
  return response.json()
}

export async function createOrchestratorRun(input: CreateRunInput): Promise<OrchestratorState & { project: OrchestratorProject; run: OrchestratorRun; assignments: AgentAssignment[] }> {
  const response = await fetch('/api/orchestrator', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'createRun', ...input }),
  })
  const payload = await response.json()
  if (!response.ok || !payload.ok) throw new Error(payload.message || `Create run failed: ${response.status}`)
  return payload
}

export async function requestApproval(runId: string, actionType: string, reason: string, riskLevel: RunApproval['risk_level'] = 'medium') {
  const response = await fetch('/api/orchestrator', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'createApproval', runId, actionType, reason, riskLevel }),
  })
  const payload = await response.json()
  if (!response.ok || !payload.ok) throw new Error(payload.message || `Approval request failed: ${response.status}`)
  return payload
}
