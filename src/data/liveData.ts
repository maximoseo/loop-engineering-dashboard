import type {
  BacklogItem,
  DataHealth,
  EvalResult,
  FailurePattern,
  ImprovementProposal,
  Iteration,
  LoopPhase,
  LoopPhaseState,
  LoopState,
  LoopTableName,
  ProposalStatus,
  ScoreBreakdown,
  LessonRecord,
  ActivationRecord,
} from '../types.ts'
import { humanizeTarget, summarizeCost, cleanIterationTask } from '../lib/loopFormat.ts'
import { getAccessToken } from '../lib/supabase.ts'
import { emptyLoopState } from './mockData.ts'
import { buildDataHealth, emptyDataHealth, requiredLoopTables } from './dataHealth.ts'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

const PHASE_ORDER: LoopPhase[] = [
  'OBSERVING',
  'SCORING',
  'LEARNING',
  'PROPOSING',
  'TESTING',
  'ACTIVATING',
  'MONITORING',
]

const hasSupabaseConfig = () => Boolean(SUPABASE_URL && SUPABASE_KEY)

// Reads authenticate as the signed-in operator: the anon key is still required
// as the Supabase `apikey` header, but the Authorization bearer must be the
// user's session token so RLS sees the `authenticated` role — never the anon key.
const supabaseHeaders = async () => {
  if (!SUPABASE_KEY) throw new Error('Missing VITE_SUPABASE_ANON_KEY')
  const token = await getAccessToken()
  if (!token) throw new Error('Not authenticated')
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${token}`,
  }
}

async function rest<T>(path: string): Promise<T> {
  if (!SUPABASE_URL) throw new Error('Missing VITE_SUPABASE_URL')
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: await supabaseHeaders(),
  })
  if (!res.ok) throw new Error(`Supabase ${path}: HTTP ${res.status}`)
  return (await res.json()) as T
}

async function safeRest<T>(path: string, fallback: T, errors: string[], label: string): Promise<T> {
  try {
    return await rest<T>(path)
  } catch (error) {
    errors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`)
    return fallback
  }
}

async function countRows(table: LoopTableName | 'loop_proposals', filter = ''): Promise<number> {
  if (!SUPABASE_URL) throw new Error('Missing VITE_SUPABASE_URL')
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?select=id${filter ? `&${filter}` : ''}`,
    {
      method: 'HEAD',
      headers: {
        ...(await supabaseHeaders()),
        Prefer: 'count=exact',
        Range: '0-0',
      },
    },
  )
  if (!res.ok) throw new Error(`Supabase ${table}: HTTP ${res.status}`)
  const range = res.headers.get('content-range')
  const total = range?.split('/')[1]
  return total && total !== '*' ? Number(total) : 0
}

async function safeCountRows(
  table: LoopTableName | 'loop_proposals',
  errors: string[],
  filter = '',
): Promise<number | null> {
  try {
    return await countRows(table, filter)
  } catch (error) {
    errors.push(`${table}${filter ? ` (${filter})` : ''}: ${error instanceof Error ? error.message : String(error)}`)
    return null
  }
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
  plan: string | null
  tools_used: unknown[]
  token_usage: number
  turn_count: number
  duration_seconds: number
}

interface LessonRefRow {
  source_task_id: string
}

interface ProposalRefRow {
  proposal_id: string
  source_lessons: string[]
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
  old_value?: string
  new_value?: string
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

interface AllLessonRow {
  lesson_id: string
  lesson_type: string
  content: string
  confidence: number
  applied: boolean
  created_at: string
}

interface ActivationRow {
  id: string
  proposal_id: string
  action: ActivationRecord['action']
  reason: string | null
  created_at: string
}

interface CostRow {
  model: string | null
  provider: string | null
  input_tokens: number
  output_tokens: number
  estimated_cost_usd: number
}

interface EvalRow {
  run_id: string
  eval_name: string
  score: number
  passed: boolean
  baseline_score: number | null
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
  health: DataHealth
}

export async function fetchLoopState(): Promise<LiveResult> {
  const startedAt = performance.now()
  if (!hasSupabaseConfig()) {
    return {
      state: emptyLoopState,
      live: false,
      health: emptyDataHealth('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY'),
    }
  }

  const errors: string[] = []
  const countPairs = await Promise.all(
    requiredLoopTables.map(async (table) => [table, await safeCountRows(table, errors)] as const),
  )
  const tableCounts = Object.fromEntries(countPairs) as Record<LoopTableName, number | null>
  const finishedCountsAt = performance.now()
  const totalIterations = tableCounts.loop_iterations ?? 0
  const healthFromCounts = buildDataHealth({
    tableCounts,
    errors,
    startedAt,
    finishedAt: finishedCountsAt,
  })

  if (totalIterations === 0) {
    return { state: emptyLoopState, live: false, health: healthFromCounts }
  }

  const [stateRows, iterRows, scoreRows, proposalRows, failureRows, lessonRows, evalRows, activatedRaw, rolledBackRaw, allLessonRows, activationRows, costRows] =
    await Promise.all([
      safeRest<StateRow[]>('loop_state?id=eq.main', [], errors, 'loop_state'),
      safeRest<IterationRow[]>('loop_iterations?order=ts.desc&limit=8', [], errors, 'loop_iterations'),
      safeRest<ScoreRow[]>('loop_scores?order=created_at.desc&limit=60', [], errors, 'loop_scores'),
      safeRest<ProposalRow[]>('loop_proposals?order=created_at.desc&limit=8', [], errors, 'loop_proposals'),
      safeRest<FailureRow[]>('loop_failure_patterns?order=frequency.desc&limit=8', [], errors, 'loop_failure_patterns'),
      safeRest<LessonRow[]>(
        'loop_lessons?lesson_type=eq.optimization&applied=eq.false&order=confidence.desc&limit=6',
        [],
        errors,
        'loop_lessons',
      ),
      safeRest<EvalRow[]>('loop_eval_results?order=created_at.desc&limit=32', [], errors, 'loop_eval_results'),
      safeCountRows('loop_proposals', errors, 'status=eq.active'),
      safeCountRows('loop_proposals', errors, 'status=eq.rolled_back'),
      safeRest<AllLessonRow[]>(
        'loop_lessons?select=lesson_id,lesson_type,content,confidence,applied,created_at&order=created_at.desc&limit=200',
        [],
        errors,
        'loop_lessons_all',
      ),
      safeRest<ActivationRow[]>(
        'loop_activations?select=id,proposal_id,action,reason,created_at&order=created_at.desc&limit=40',
        [],
        errors,
        'loop_activations',
      ),
      safeRest<CostRow[]>(
        'loop_cost_events?select=model,provider,input_tokens,output_tokens,estimated_cost_usd&order=created_at.desc&limit=500',
        [],
        errors,
        'loop_cost_events',
      ),
    ])
  const activated = activatedRaw ?? 0
  const rolledBack = rolledBackRaw ?? 0

  const stateRow = stateRows[0]
  const scoreByTask = new Map(scoreRows.map((s) => [s.task_id, s]))

  const visibleIds = iterRows.map((r) => r.task_id)
  const idFilter = visibleIds.map((id) => `"${id}"`).join(',')
  const [lessonRefs, proposalRefs] = visibleIds.length
    ? await Promise.all([
        safeRest<LessonRefRow[]>(`loop_lessons?select=source_task_id&source_task_id=in.(${idFilter})`, [], errors, 'loop_lesson_refs'),
        safeRest<ProposalRefRow[]>('loop_proposals?select=proposal_id,source_lessons&limit=200', [], errors, 'loop_proposal_refs'),
      ])
    : [[], []]
  const lessonCount = new Map<string, number>()
  for (const ref of lessonRefs) {
    lessonCount.set(ref.source_task_id, (lessonCount.get(ref.source_task_id) ?? 0) + 1)
  }
  const proposalCount = new Map<string, number>()
  for (const ref of proposalRefs) {
    const tasks = new Set(
      (ref.source_lessons ?? [])
        .map((lessonId) => lessonId.split(/-L\d+$/)[0])
        .filter((taskId) => visibleIds.includes(taskId)),
    )
    for (const taskId of tasks) {
      proposalCount.set(taskId, (proposalCount.get(taskId) ?? 0) + 1)
    }
  }

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
    const task = r.user_request?.trim() || r.plan?.trim() || r.task_id
    return {
      id: r.task_id,
      timestamp: shortTime(r.ts),
      task: cleanIterationTask(task).slice(0, 120),
      score: score ? toBreakdown(score) : emptyBreakdown(0),
      lessons_extracted: lessonCount.get(r.task_id) ?? 0,
      proposals_made: proposalCount.get(r.task_id) ?? 0,
      tools_used: Array.isArray(r.tools_used) ? r.tools_used.length : 0,
      token_usage: r.token_usage ?? 0,
      duration_seconds: Number(r.duration_seconds ?? 0),
    }
  })

  const improvements: ImprovementProposal[] = proposalRows.map((p) => ({
    id: p.proposal_id,
    timestamp: shortTime(p.created_at),
    type: p.type,
    target: humanizeTarget(p.target),
    description: (p.rationale ?? '').slice(0, 160),
    old_value: p.old_value,
    new_value: p.new_value,
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
  const runKind = (runId: string) => (runId.startsWith('base') ? 'baseline' : 'candidate')
  const latestKind = latestRunId ? runKind(latestRunId) : 'baseline'
  const previousSameKind = evalRows.filter(
    (e) => e.run_id !== latestRunId && runKind(e.run_id) === latestKind,
  )
  const evalResults: EvalResult[] = latest.map((e) => {
    const reference =
      e.baseline_score ?? previousSameKind.find((p) => p.eval_name === e.eval_name)?.score ?? null
    const trend: EvalResult['trend'] =
      reference === null
        ? 'stable'
        : e.score > reference
          ? 'up'
          : e.score < reference
            ? 'down'
            : 'stable'
    return {
      name: e.eval_name,
      status: e.passed ? (e.score < 80 ? 'warn' : 'pass') : 'fail',
      score: e.score,
      trend,
    }
  })
  const evalRunLabel = latest.length
    ? `${latestKind === 'baseline' ? 'Baseline' : 'Candidate'} run · ${shortTime(latest[latest.length - 1].created_at)}`
    : undefined

  const chronological = [...scoreRows].reverse()
  const scoreTrend = chronological.slice(-50).map((s) => s.total)
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000
  const recentScores = scoreRows.filter((s) => new Date(s.created_at).getTime() >= weekAgo)
  const avg7d = recentScores.length
    ? Math.round(recentScores.reduce((a, s) => a + s.total, 0) / recentScores.length)
    : 0

  const lastScoreRow = scoreRows[0]
  const score_history: ScoreBreakdown[] = [...scoreRows].reverse().map(toBreakdown)
  const lessons: LessonRecord[] = allLessonRows.map((l) => ({
    id: l.lesson_id,
    type: l.lesson_type,
    target: '',
    content: l.content,
    applied: l.applied,
    confidence: l.confidence,
    created_at: l.created_at,
  }))

  const activations: ActivationRecord[] = activationRows.map((a) => ({
    id: a.id,
    proposal_id: a.proposal_id,
    action: a.action,
    reason: a.reason ?? undefined,
    created_at: a.created_at,
  }))
  const cost = summarizeCost(costRows)

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
    eval_run_label: evalRunLabel,
    score_trend: scoreTrend.length ? scoreTrend : [0],
    score_history,
    lessons,
    activations,
    cost,
  }

  const health = buildDataHealth({
    tableCounts,
    errors,
    startedAt,
    finishedAt: performance.now(),
  })

  return { state, live: health.mode === 'live' || health.mode === 'partial', health }
}
