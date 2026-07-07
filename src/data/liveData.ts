import type {
  BacklogItem,
  EvalResult,
  FailurePattern,
  ImprovementProposal,
  Iteration,
  LoopPhase,
  LoopPhaseState,
  LoopState,
  ProposalStatus,
  ScoreBreakdown,
} from '../types.ts'
import { mockLoopState } from './mockData.ts'

const SUPABASE_URL: string =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  'https://wtpczvyupmavzrxisvcm.supabase.co'
const SUPABASE_KEY: string =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  'sb_publishable_18clQsCD_wPvkwINu0dSuw_VGDP0iD0'

const PHASE_ORDER: LoopPhase[] = [
  'OBSERVING',
  'SCORING',
  'LEARNING',
  'PROPOSING',
  'TESTING',
  'ACTIVATING',
  'MONITORING',
]

async function rest<T>(path: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  })
  if (!res.ok) throw new Error(`Supabase ${path}: HTTP ${res.status}`)
  return (await res.json()) as T
}

async function countRows(table: string, filter = ''): Promise<number> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?select=id${filter ? `&${filter}` : ''}`,
    {
      method: 'HEAD',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Prefer: 'count=exact',
        Range: '0-0',
      },
    },
  )
  const range = res.headers.get('content-range')
  const total = range?.split('/')[1]
  return total && total !== '*' ? Number(total) : 0
}

interface StateRow {
  phase: string
  current_task_id: string | null
  active_proposal_id: string | null
  last_score: number | null
  details: Record<string, unknown>
  updated_at: string
}

interface IterationRow {
  task_id: string
  ts: string
  user_request: string | null
  tools_used: unknown[]
  token_usage: number
  turn_count: number
  duration_seconds: number
}

interface ScoreRow {
  task_id: string
  total: number
  breakdown: Partial<ScoreBreakdown>
  created_at: string
}

interface ProposalRow {
  proposal_id: string
  type: ImprovementProposal['type']
  target: string
  rationale: string | null
  risk_level: ImprovementProposal['risk_level']
  status: ProposalStatus
  eval_summary: { baseline?: number; candidate?: number; rolled_back_reason?: string }
  created_at: string
}

interface FailureRow {
  pattern_key: string
  description: string
  severity: string
  frequency: number
  last_seen: string
  examples: unknown[]
}

interface LessonRow {
  lesson_id: string
  lesson_type: string
  content: string
  evidence: string | null
  confidence: number
  applied: boolean
}

interface EvalRow {
  run_id: string
  eval_name: string
  score: number
  passed: boolean
  created_at: string
}

function emptyBreakdown(total: number): ScoreBreakdown {
  return {
    task_success: 0,
    accuracy: 0,
    user_alignment: 0,
    tool_quality: 0,
    efficiency: 0,
    safety: 0,
    validation: 0,
    memory_learning: 0,
    total,
  }
}

function toBreakdown(row: ScoreRow): ScoreBreakdown {
  return { ...emptyBreakdown(row.total), ...row.breakdown, total: row.total }
}

function shortTime(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

export interface LiveResult {
  state: LoopState
  live: boolean
}

export async function fetchLoopState(): Promise<LiveResult> {
  const totalIterations = await countRows('loop_iterations')
  if (totalIterations === 0) {
    return { state: mockLoopState, live: false }
  }

  const [stateRows, iterRows, scoreRows, proposalRows, failureRows, lessonRows, evalRows, activated, rolledBack] =
    await Promise.all([
      rest<StateRow[]>('loop_state?id=eq.main'),
      rest<IterationRow[]>('loop_iterations?order=ts.desc&limit=8'),
      rest<ScoreRow[]>('loop_scores?order=created_at.desc&limit=60'),
      rest<ProposalRow[]>('loop_proposals?order=created_at.desc&limit=8'),
      rest<FailureRow[]>('loop_failure_patterns?order=frequency.desc&limit=8'),
      rest<LessonRow[]>(
        'loop_lessons?lesson_type=eq.optimization&applied=eq.false&order=confidence.desc&limit=6',
      ),
      rest<EvalRow[]>('loop_eval_results?order=created_at.desc&limit=32'),
      countRows('loop_proposals', 'status=eq.active'),
      countRows('loop_proposals', 'status=eq.rolled_back'),
    ])

  const stateRow = stateRows[0]
  const scoreByTask = new Map(scoreRows.map((s) => [s.task_id, s]))

  const currentPhase = (stateRow?.phase ?? 'idle').toUpperCase() as LoopPhase | 'IDLE'
  const currentIdx = PHASE_ORDER.indexOf(currentPhase as LoopPhase)
  const phaseDetails = (stateRow?.details?.phases ?? {}) as Record<
    string,
    { detail?: string; timestamp?: string }
  >
  const phases: LoopPhaseState[] = PHASE_ORDER.map((name, i) => {
    const info = phaseDetails[name.toLowerCase()] ?? {}
    let status: LoopPhaseState['status'] = 'pending'
    if (currentIdx >= 0) status = i < currentIdx ? 'done' : i === currentIdx ? 'active' : 'pending'
    return { name, status, detail: info.detail, timestamp: info.timestamp }
  })

  const iterations: Iteration[] = iterRows.map((r) => {
    const score = scoreByTask.get(r.task_id)
    return {
      id: r.task_id,
      timestamp: shortTime(r.ts),
      task: (r.user_request ?? '(no request captured)').slice(0, 120),
      score: score ? toBreakdown(score) : emptyBreakdown(0),
      lessons_extracted: 0,
      proposals_made: 0,
      tools_used: Array.isArray(r.tools_used) ? r.tools_used.length : 0,
      token_usage: r.token_usage ?? 0,
      duration_seconds: Number(r.duration_seconds ?? 0),
    }
  })

  const improvements: ImprovementProposal[] = proposalRows.map((p) => ({
    id: p.proposal_id,
    timestamp: shortTime(p.created_at),
    type: p.type,
    target: p.target,
    description: (p.rationale ?? '').slice(0, 160),
    status: p.status,
    risk_level: p.risk_level,
    eval_score_before: p.eval_summary?.baseline ?? 0,
    eval_score_after: p.eval_summary?.candidate ?? 0,
    rolled_back_reason: p.eval_summary?.rolled_back_reason,
  }))

  const failures: FailurePattern[] = failureRows.map((f) => ({
    id: f.pattern_key,
    pattern: f.description,
    category: f.severity,
    frequency: f.frequency,
    last_seen: f.last_seen.slice(0, 10),
    mitigation: undefined,
  }))

  const backlog: BacklogItem[] = lessonRows.map((l) => ({
    id: l.lesson_id,
    priority: l.confidence >= 0.85 ? 'high' : l.confidence >= 0.6 ? 'medium' : 'low',
    title: l.content.slice(0, 80),
    description: (l.evidence ?? l.content).slice(0, 160),
    estimated_impact: `confidence ${(l.confidence * 100).toFixed(0)}%`,
    status: 'pending',
  }))

  const latestRunId = evalRows[0]?.run_id
  const latest = evalRows.filter((e) => e.run_id === latestRunId)
  const previous = evalRows.filter((e) => e.run_id !== latestRunId)
  const evalResults: EvalResult[] = latest.map((e) => {
    const prev = previous.find((p) => p.eval_name === e.eval_name)
    const trend: EvalResult['trend'] = !prev
      ? 'stable'
      : e.score > prev.score
        ? 'up'
        : e.score < prev.score
          ? 'down'
          : 'stable'
    return {
      name: e.eval_name,
      status: e.passed ? (e.score < 80 ? 'warn' : 'pass') : 'fail',
      score: e.score,
      trend,
    }
  })

  const chronological = [...scoreRows].reverse()
  const scoreTrend = chronological.slice(-50).map((s) => s.total)
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000
  const recentScores = scoreRows.filter((s) => new Date(s.created_at).getTime() >= weekAgo)
  const avg7d = recentScores.length
    ? Math.round(recentScores.reduce((a, s) => a + s.total, 0) / recentScores.length)
    : 0

  const lastScoreRow = scoreRows[0]

  const state: LoopState = {
    current_phase: currentIdx >= 0 ? (currentPhase as LoopPhase) : 'IDLE',
    is_loop_running: (stateRow?.phase ?? 'idle') !== 'idle',
    avg_score_7d: avg7d,
    total_iterations: totalIterations,
    improvements_activated: activated,
    improvements_rolled_back: rolledBack,
    last_score: lastScoreRow ? toBreakdown(lastScoreRow) : emptyBreakdown(0),
    phases,
    recent_iterations: iterations,
    recent_improvements: improvements,
    failure_library: failures,
    optimization_backlog: backlog,
    eval_results: evalResults,
    score_trend: scoreTrend.length ? scoreTrend : [0],
  }

  return { state, live: true }
}
