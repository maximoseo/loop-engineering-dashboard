export type LoopPhase = 'IDLE' | 'OBSERVING' | 'SCORING' | 'LEARNING' | 'PROPOSING' | 'TESTING' | 'ACTIVATING' | 'MONITORING'
export type PhaseStatus = 'pending' | 'active' | 'done' | 'error'
export type ProposalType = 'memory' | 'skill' | 'prompt' | 'config' | 'mcp'
export type ProposalStatus = 'proposed' | 'testing' | 'pending_approval' | 'active' | 'rejected' | 'rolled_back'
export type EvalStatus = 'pass' | 'warn' | 'fail'
export type DataHealthMode = 'live' | 'demo' | 'partial' | 'error'
export type LoopTableName =
  | 'loop_iterations'
  | 'loop_state'
  | 'loop_scores'
  | 'loop_proposals'
  | 'loop_failure_patterns'
  | 'loop_lessons'
  | 'loop_eval_results'

export interface DataHealth {
  mode: DataHealthMode
  source: 'supabase' | 'mock'
  lastSuccessfulFetch: string | null
  fetchDurationMs: number | null
  tableCounts: Record<LoopTableName, number | null>
  staleTables: LoopTableName[]
  errors: string[]
}

export interface LoopPhaseState {
  name: LoopPhase
  status: PhaseStatus
  detail?: string
  timestamp?: string
}

export interface ScoreBreakdown {
  task_success: number
  accuracy: number
  user_alignment: number
  tool_quality: number
  efficiency: number
  safety: number
  validation: number
  memory_learning: number
  total: number
}

export interface Iteration {
  id: string
  timestamp: string
  task: string
  score: ScoreBreakdown
  lessons_extracted: number
  proposals_made: number
  tools_used: number
  token_usage: number
  duration_seconds: number
}

export interface ImprovementProposal {
  id: string
  timestamp: string
  type: ProposalType
  target: string
  description: string
  status: ProposalStatus
  risk_level: 'low' | 'medium' | 'high'
  eval_score_before: number
  eval_score_after: number
  rolled_back_reason?: string
  old_value?: string
  new_value?: string
}

export interface FailurePattern {
  id: string
  pattern: string
  category: string
  frequency: number
  last_seen: string
  mitigation?: string
}

export interface BacklogItem {
  id: string
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  estimated_impact: string
  status: 'pending' | 'in_progress' | 'completed'
}

export interface LessonRecord {
  id: string
  type: string
  target: string
  content: string
  applied: boolean
  confidence: number
  created_at: string
}

export interface EvalResult {
  name: string
  status: EvalStatus
  score: number
  trend: 'up' | 'down' | 'stable'
}

export interface LoopState {
  current_phase: LoopPhase
  phases: LoopPhaseState[]
  last_score: ScoreBreakdown
  avg_score_7d: number
  total_iterations: number
  improvements_activated: number
  improvements_rolled_back: number
  recent_iterations: Iteration[]
  recent_improvements: ImprovementProposal[]
  failure_library: FailurePattern[]
  optimization_backlog: BacklogItem[]
  eval_results: EvalResult[]
  eval_run_label?: string
  score_trend: number[]
  is_loop_running: boolean
  score_history?: ScoreBreakdown[]
  lessons?: LessonRecord[]
}

export type LoopTaskKind = 'agent-run' | 'project' | 'debug' | 'dashboard' | 'proposal'
export type LoopTaskPriority = 'normal' | 'high' | 'urgent'
export type LoopTaskDestination = 'auto' | 'telegram' | 'worker-webhook'
export type LoopTaskStatus = 'queued' | 'delivered' | 'accepted' | 'running' | 'needs_review' | 'done' | 'failed' | 'blocked_config' | 'archived'
export type LoopTaskResolvedDestination = 'pending' | 'telegram' | 'worker-webhook' | 'blocked' | 'failed'

export interface LoopTaskProcessStep {
  label: string
  state: 'pending' | 'active' | 'done' | 'blocked' | 'error'
  detail: string
}

export interface LoopTaskHandoff {
  task_id: string
  task: string
  kind: LoopTaskKind
  priority: LoopTaskPriority
  destination: LoopTaskDestination
  resolved_destination: LoopTaskResolvedDestination
  status: LoopTaskStatus
  delivery_message: string | null
  process: LoopTaskProcessStep[]
  result_summary: string | null
  telegram_message_id: string | null
  created_at: string
  updated_at: string
  claimed_at: string | null
  completed_at: string | null
  error: string | null
}

export interface LoopTaskEvent {
  id: string
  task_id: string
  event_type: string
  message: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface OrchestratorProject {
  project_id: string
  name: string
  objective: string
  status: 'draft' | 'active' | 'paused' | 'done' | 'failed' | 'archived'
  scope: Record<string, unknown>
  constraints: string[]
  success_criteria: string[]
  created_at: string
  updated_at: string
}

export interface OrchestratorRun {
  run_id: string
  project_id: string
  mode: 'lead_agent' | 'parallel_specialists' | 'debate' | 'pipeline' | 'swarm_verify'
  status: 'draft' | 'queued' | 'planning' | 'dispatching' | 'running' | 'verifying' | 'needs_review' | 'done' | 'failed' | 'cancelled'
  strategy: Record<string, unknown>
  budget: Record<string, unknown>
  created_at: string
  updated_at: string
  started_at: string | null
  finished_at: string | null
}

export interface AgentRegistryEntry {
  agent_id: string
  name: string
  type: string
  role: string
  capabilities: string[]
  allowed_tools: string[]
  default_model_profile_id: string | null
  status: 'online' | 'offline' | 'degraded' | 'disabled'
  last_heartbeat: string | null
}

export interface ModelProfile {
  model_profile_id: string
  label: string
  provider: string
  model: string
  purpose: string
  cost_tier: 'low' | 'medium' | 'high'
  latency_tier: 'fast' | 'normal' | 'slow'
  capabilities: Record<string, unknown>
  fallback_profile_ids: string[]
  enabled: boolean
}

export interface AgentAssignment {
  assignment_id: string
  run_id: string
  project_id: string
  agent_id: string
  model_profile_id: string | null
  status: 'queued' | 'leased' | 'running' | 'blocked' | 'needs_review' | 'done' | 'failed' | 'cancelled'
  lease_owner: string | null
  lease_expires_at: string | null
  input: Record<string, unknown>
  output: Record<string, unknown>
  error: string | null
  created_at: string
  updated_at: string
  started_at: string | null
  completed_at: string | null
}

export interface AgentEvent {
  id: string
  run_id: string
  assignment_id: string | null
  agent_id: string | null
  event_type: string
  message: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface RunApproval {
  approval_id: string
  run_id: string
  assignment_id: string | null
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  action_type: string
  status: 'pending' | 'approved' | 'rejected' | 'expired'
  reason: string | null
  created_at: string
  resolved_at: string | null
}

export interface RunArtifact {
  artifact_id: string
  run_id: string
  assignment_id: string | null
  type: string
  name: string
  uri: string | null
  summary: string | null
  created_at: string
}

export interface WorkerHeartbeat {
  worker_id: string
  agent_id: string | null
  status: 'online' | 'offline' | 'degraded'
  current_assignment_id: string | null
  last_heartbeat: string
}

export interface DashboardMeta {
  id: string
  name: string
  description: string
  url: string
  github: string
  category: string
  status: 'live' | 'development' | 'planned'
  icon: string
}
