export type LoopPhase = 'IDLE' | 'OBSERVING' | 'SCORING' | 'LEARNING' | 'PROPOSING' | 'TESTING' | 'ACTIVATING' | 'MONITORING'
export type PhaseStatus = 'pending' | 'active' | 'done' | 'error'
export type ProposalType = 'memory' | 'skill' | 'prompt' | 'config' | 'mcp'
export type ProposalStatus = 'proposed' | 'testing' | 'active' | 'rejected' | 'rolled_back'
export type EvalStatus = 'pass' | 'warn' | 'fail'

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
  score_trend: number[]
  is_loop_running: boolean
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
