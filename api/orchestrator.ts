import { allowlistedEmail, authenticateSupabaseUser, workerTokenAuthorized, type AuthenticatedUser } from './_auth.js'
import { log } from './logger.js'
import { OrchestratorActionSchema, validate } from './schemas.js'
import { workspaceForUser, workspaceForWorker } from './_workspace.js'

type VercelRequest = {
  method?: string
  body?: unknown
  headers: Record<string, string | string[] | undefined>
  query?: Record<string, string | string[] | undefined>
}

type VercelResponse = {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
  setHeader: (name: string, value: string) => void
}

type OrchestrationMode = 'lead_agent' | 'parallel_specialists' | 'debate' | 'pipeline' | 'swarm_verify'
type AssignmentStatus = 'queued' | 'leased' | 'running' | 'blocked' | 'needs_review' | 'done' | 'failed' | 'cancelled'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
const WORKER_TOKEN = process.env.ORCHESTRATOR_WORKER_TOKEN

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function parseBody(body: unknown): Record<string, unknown> | null {
  let candidate = body
  if (typeof candidate === 'string') {
    if (candidate.length > 50_000) return null
    try { candidate = JSON.parse(candidate) } catch { return null }
  }
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null
  try {
    if (JSON.stringify(candidate).length > 50_000) return null
  } catch {
    return null
  }
  return candidate as Record<string, unknown>
}

function q(req: VercelRequest, key: string): string | undefined {
  const value = req.query?.[key]
  return Array.isArray(value) ? value[0] : value
}

function workerAuthorized(req: VercelRequest) {
  return workerTokenAuthorized(req, WORKER_TOKEN)
}

function supabaseHeaders(prefer?: string) {
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'content-type': 'application/json',
    ...(prefer ? { prefer } : {}),
  }
}

async function sb(path: string, init: RequestInit = {}) {
  if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL')
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...supabaseHeaders(), ...(init.headers || {}) },
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Supabase ${path}: HTTP ${response.status} ${text.slice(0, 180)}`)
  }
  if (response.status === 204) return null
  return response.json()
}

async function insert(table: string, row: Record<string, unknown>) {
  return sb(`${table}`, { method: 'POST', headers: supabaseHeaders('return=representation'), body: JSON.stringify(row) })
}

async function patch(table: string, filter: string, row: Record<string, unknown>) {
  return sb(`${table}?${filter}`, { method: 'PATCH', headers: supabaseHeaders('return=representation'), body: JSON.stringify(row) })
}

async function event(workspace_id: string, run_id: string, event_type: string, message: string, metadata: Record<string, unknown> = {}, assignment_id?: string, agent_id?: string) {
  await insert('loop_agent_events', { workspace_id, run_id, assignment_id: assignment_id || null, agent_id: agent_id || null, event_type, message, metadata })
}

const modeAgents: Record<OrchestrationMode, string[]> = {
  lead_agent: ['planner', 'qa_verifier'],
  parallel_specialists: ['planner', 'frontend_builder', 'backend_builder', 'qa_verifier', 'security_guard'],
  debate: ['planner', 'orchestrator', 'qa_verifier'],
  pipeline: ['planner', 'backend_builder', 'frontend_builder', 'qa_verifier', 'security_guard'],
  swarm_verify: ['planner', 'frontend_builder', 'backend_builder', 'seo_researcher', 'qa_verifier', 'security_guard'],
}

async function getAgent(workspace_id: string, agent_id: string) {
  const rows = await sb(`loop_agent_registry?select=*&workspace_id=eq.${encodeURIComponent(workspace_id)}&agent_id=eq.${encodeURIComponent(agent_id)}&limit=1`) as Array<Record<string, unknown>>
  return rows[0]
}

async function createProjectAndRun(workspace_id: string, body: Record<string, unknown>) {
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 120) : 'Untitled orchestration project'
  const objective = typeof body.objective === 'string' && body.objective.trim() ? body.objective.trim().slice(0, 4000) : 'Coordinate multiple agents on a shared project.'
  const mode = ['lead_agent','parallel_specialists','debate','pipeline','swarm_verify'].includes(String(body.mode)) ? body.mode as OrchestrationMode : 'parallel_specialists'
  const project_id = id('proj')
  const run_id = id('run')
  const constraints = Array.isArray(body.constraints) ? body.constraints : ['No secrets in UI', 'Human approval for high-risk actions', 'Production QA required']
  const success_criteria = Array.isArray(body.successCriteria) ? body.successCriteria : ['Assignments created', 'Verifier reviews outputs', 'Dashboard shows run status']
  const budget = body.budget && typeof body.budget === 'object' ? body.budget as Record<string, unknown> : { maxParallelAgents: 5, maxRuntimeMinutes: 45, maxCostUsd: 5 }

  const [project] = await insert('loop_projects', {
    workspace_id,
    project_id,
    name,
    objective,
    scope: { source: 'dashboard', contextUrl: body.contextUrl || null },
    constraints,
    success_criteria,
    status: 'active',
  }) as Array<Record<string, unknown>>

  const [run] = await insert('loop_orchestrator_runs', {
    workspace_id,
    run_id,
    project_id,
    mode,
    status: 'dispatching',
    strategy: { mode, planner: 'orchestrator', verifierRequired: true, resourceLocks: true },
    budget,
    started_at: new Date().toISOString(),
  }) as Array<Record<string, unknown>>

  await event(workspace_id, run_id, 'project_created', `Project created: ${name}`, { project_id, mode })
  await event(workspace_id, run_id, 'run_dispatching', `Creating ${modeAgents[mode].length} assignments for ${mode}.`, { agents: modeAgents[mode] })

  const assignments: Array<Record<string, unknown>> = []
  for (const agent_id of modeAgents[mode]) {
    const agent = await getAgent(workspace_id, agent_id)
    const assignment_id = id(`assign-${agent_id.replaceAll('_','-')}`)
    const title = agent_id === 'planner'
      ? 'Create execution plan and split work safely.'
      : agent_id === 'qa_verifier'
        ? 'Verify outputs, tests, production UI, and final evidence.'
        : agent_id === 'security_guard'
          ? 'Review secrets, risky actions, and approval requirements.'
          : `Execute ${String(agent?.role || agent_id)} workstream.`
    const [assignment] = await insert('loop_agent_assignments', {
      workspace_id,
      assignment_id,
      run_id,
      project_id,
      agent_id,
      model_profile_id: agent?.default_model_profile_id || null,
      status: 'queued',
      input: { title, objective, projectName: name, mode, constraints, successCriteria: success_criteria },
    }) as Array<Record<string, unknown>>
    assignments.push(assignment)
    await event(workspace_id, run_id, 'assignment_created', title, { assignment_id, model_profile_id: agent?.default_model_profile_id || null }, assignment_id, agent_id)
  }

  await patch('loop_orchestrator_runs', `workspace_id=eq.${encodeURIComponent(workspace_id)}&run_id=eq.${encodeURIComponent(run_id)}`, { status: 'running' })
  await event(workspace_id, run_id, 'run_running', 'Assignments are queued and ready for workers.', { assignmentCount: assignments.length })
  return { project, run: { ...run, status: 'running' }, assignments }
}

async function listState(workspace_id: string) {
  const [projects, runs, assignments, events, agents, models, approvals, artifacts, heartbeats] = await Promise.all([
    sb(`loop_projects?select=*&workspace_id=eq.${workspace_id}&order=created_at.desc&limit=10`),
    sb(`loop_orchestrator_runs?select=*&workspace_id=eq.${workspace_id}&order=created_at.desc&limit=10`),
    sb(`loop_agent_assignments?select=*&workspace_id=eq.${workspace_id}&order=created_at.desc&limit=30`),
    sb(`loop_agent_events?select=*&workspace_id=eq.${workspace_id}&order=created_at.desc&limit=40`),
    sb(`loop_agent_registry?select=*&workspace_id=eq.${workspace_id}&order=agent_id.asc`),
    sb(`loop_model_profiles?select=*&workspace_id=eq.${workspace_id}&enabled=eq.true&order=model_profile_id.asc`),
    sb(`loop_run_approvals?select=*&workspace_id=eq.${workspace_id}&order=created_at.desc&limit=20`),
    sb(`loop_run_artifacts?select=*&workspace_id=eq.${workspace_id}&order=created_at.desc&limit=20`),
    sb(`loop_worker_heartbeats?select=*&workspace_id=eq.${workspace_id}&order=last_heartbeat.desc&limit=20`),
  ])
  return { projects, runs, assignments, events, agents, models, approvals, artifacts, heartbeats }
}

async function lease(workspace_id: string, body: Record<string, unknown>) {
  const worker_id = typeof body.workerId === 'string' ? body.workerId : 'worker-unknown'
  const allowedAgents = Array.isArray(body.agentIds) ? body.agentIds.map(String) : []
  await insert('loop_worker_heartbeats', { workspace_id, worker_id, status: 'online', metadata: { allowedAgents } }).catch(async () => {
    await patch('loop_worker_heartbeats', `workspace_id=eq.${workspace_id}&worker_id=eq.${encodeURIComponent(worker_id)}`, { status: 'online', last_heartbeat: new Date().toISOString(), metadata: { allowedAgents } })
  })
  const agentFilter = allowedAgents.length ? `&agent_id=in.(${allowedAgents.map(encodeURIComponent).join(',')})` : ''
  const candidates = await sb(`loop_agent_assignments?select=*&workspace_id=eq.${workspace_id}&status=eq.queued${agentFilter}&order=created_at.asc&limit=1`) as Array<Record<string, unknown>>
  const assignment = candidates[0]
  if (!assignment) return { assignment: null }
  const lease_expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString()
  const [leased] = await patch('loop_agent_assignments', `workspace_id=eq.${workspace_id}&assignment_id=eq.${encodeURIComponent(String(assignment.assignment_id))}&status=eq.queued`, {
    status: 'leased',
    lease_owner: worker_id,
    lease_expires_at,
    started_at: new Date().toISOString(),
  }) as Array<Record<string, unknown>>
  if (!leased) return { assignment: null }
  await event(workspace_id, String(leased.run_id), 'assignment_leased', `Assignment leased by ${worker_id}.`, { worker_id, lease_expires_at }, String(leased.assignment_id), String(leased.agent_id))
  return { assignment: leased }
}

async function workerEvent(workspace_id: string, body: Record<string, unknown>) {
  const run_id = String(body.runId || '')
  if (!run_id) throw new Error('runId required')
  const runs = await sb(`loop_orchestrator_runs?select=run_id&workspace_id=eq.${workspace_id}&run_id=eq.${encodeURIComponent(run_id)}&limit=1`) as Array<Record<string, unknown>>
  if (!runs[0]) throw new Error('Run not found in workspace')
  if (body.assignmentId) {
    const assignments = await sb(`loop_agent_assignments?select=assignment_id&workspace_id=eq.${workspace_id}&assignment_id=eq.${encodeURIComponent(String(body.assignmentId))}&run_id=eq.${encodeURIComponent(run_id)}&lease_owner=eq.${encodeURIComponent(String(body.workerId))}&limit=1`) as Array<Record<string, unknown>>
    if (!assignments[0]) throw new Error('Assignment is not leased by this worker')
  }
  await event(workspace_id, run_id, String(body.eventType || 'worker_event'), String(body.message || 'Worker event.'), (body.metadata || {}) as Record<string, unknown>, body.assignmentId ? String(body.assignmentId) : undefined, body.agentId ? String(body.agentId) : undefined)
  return { ok: true }
}

async function complete(workspace_id: string, body: Record<string, unknown>, status: AssignmentStatus) {
  const assignment_id = String(body.assignmentId || '')
  if (!assignment_id) throw new Error('assignmentId required')
  const output = body.output && typeof body.output === 'object' ? body.output as Record<string, unknown> : { summary: body.summary || null }
  const worker_id = String(body.workerId || '')
  const [assignment] = await patch('loop_agent_assignments', `workspace_id=eq.${workspace_id}&assignment_id=eq.${encodeURIComponent(assignment_id)}&lease_owner=eq.${encodeURIComponent(worker_id)}&status=in.(leased,running)`, {
    status,
    output,
    error: status === 'failed' ? String(body.error || 'Worker failed') : null,
    completed_at: ['done','failed','needs_review','blocked'].includes(status) ? new Date().toISOString() : null,
  }) as Array<Record<string, unknown>>
  if (!assignment) throw new Error('Assignment is not leased by this worker')
  await event(workspace_id, String(assignment.run_id), `assignment_${status}`, String(output.summary || body.error || `Assignment ${status}.`), { output }, assignment_id, String(assignment.agent_id))
  await reconcileRun(workspace_id, String(assignment.run_id))
  return { assignment }
}

async function reconcileRun(workspace_id: string, run_id: string) {
  const rows = await sb(`loop_agent_assignments?select=*&workspace_id=eq.${workspace_id}&run_id=eq.${encodeURIComponent(run_id)}`) as Array<Record<string, unknown>>
  const statuses = rows.map((row) => row.status)
  let runStatus = 'running'
  if (statuses.some((s) => s === 'needs_review' || s === 'blocked')) runStatus = 'needs_review'
  if (statuses.some((s) => s === 'failed')) runStatus = 'failed'
  if (rows.length && statuses.every((s) => s === 'done')) runStatus = 'done'
  const patchRow: Record<string, unknown> = { status: runStatus }
  if (['done','failed'].includes(runStatus)) patchRow.finished_at = new Date().toISOString()
  await patch('loop_orchestrator_runs', `workspace_id=eq.${workspace_id}&run_id=eq.${encodeURIComponent(run_id)}`, patchRow)
  await event(workspace_id, run_id, 'run_reconciled', `Run status is now ${runStatus}.`, { statuses })
}

async function approve(workspace_id: string, body: Record<string, unknown>, status: 'approved' | 'rejected', actor: AuthenticatedUser) {
  const approval_id = String(body.approvalId || '')
  if (!approval_id) throw new Error('approvalId required')
  const approvedBy = actor.email || actor.id
  const [approval] = await patch('loop_run_approvals', `workspace_id=eq.${workspace_id}&approval_id=eq.${encodeURIComponent(approval_id)}&status=eq.pending`, {
    status,
    approved_by: approvedBy,
    reason: body.reason || null,
    resolved_at: new Date().toISOString(),
  }) as Array<Record<string, unknown>>
  if (!approval) throw new Error('Approval is missing or already resolved')
  await event(
    workspace_id,
    String(approval.run_id),
    `approval_${status}`,
    `Approval ${status}: ${approval.action_type}`,
    { approval_id, reason: body.reason || null, actor_user_id: actor.id, actor_email: actor.email || null },
    approval.assignment_id ? String(approval.assignment_id) : undefined,
  )
  return { approval }
}

async function createApproval(workspace_id: string, body: Record<string, unknown>) {
  const run_id = String(body.runId || '')
  if (!run_id) throw new Error('runId required')
  const runs = await sb(`loop_orchestrator_runs?select=run_id&workspace_id=eq.${workspace_id}&run_id=eq.${encodeURIComponent(run_id)}&limit=1`) as Array<Record<string, unknown>>
  if (!runs[0]) throw new Error('Run not found in workspace')
  const approval_id = id('approval')
  const [approval] = await insert('loop_run_approvals', {
    workspace_id,
    approval_id,
    run_id,
    assignment_id: body.assignmentId || null,
    risk_level: body.riskLevel || 'medium',
    action_type: body.actionType || 'manual_review',
    reason: body.reason || 'Human approval requested from dashboard.',
  }) as Array<Record<string, unknown>>
  await event(workspace_id, run_id, 'approval_requested', `Approval requested: ${approval.action_type}`, { approval_id, risk_level: approval.risk_level }, approval.assignment_id ? String(approval.assignment_id) : undefined)
  return { approval }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('content-type', 'application/json; charset=utf-8')
  log.info('orchestrator_request', { method: req.method })
  try {
    if (req.method === 'GET') {
      let workspaceId: string | null = null
      if (!workerAuthorized(req)) {
        const user = await authenticateSupabaseUser(req)
        if (!user) {
          res.status(401).json({ ok: false, message: 'Authentication required.' })
          return
        }
        if (!allowlistedEmail(user, process.env.LOOP_OPERATOR_EMAILS)) {
          res.status(403).json({ ok: false, message: 'Operator access is not configured for this account.' })
          return
        }
        workspaceId = (await workspaceForUser(req, user))?.workspaceId || null
      } else {
        workspaceId = workspaceForWorker(req)
      }
      if (!workspaceId) {
        res.status(403).json({ ok: false, message: 'Workspace access is required.' })
        return
      }
      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        log.error('orchestrator_misconfigured', { hasUrl: Boolean(SUPABASE_URL), hasKey: Boolean(SUPABASE_SERVICE_ROLE_KEY) })
        res.status(503).json({ ok: false, message: 'Orchestrator is not configured.' })
        return
      }
      const runId = q(req, 'runId')
      if (runId) {
        const [runs, assignments, events, artifacts, approvals] = await Promise.all([
          sb(`loop_orchestrator_runs?select=*&workspace_id=eq.${workspaceId}&run_id=eq.${encodeURIComponent(runId)}&limit=1`),
          sb(`loop_agent_assignments?select=*&workspace_id=eq.${workspaceId}&run_id=eq.${encodeURIComponent(runId)}&order=created_at.asc`),
          sb(`loop_agent_events?select=*&workspace_id=eq.${workspaceId}&run_id=eq.${encodeURIComponent(runId)}&order=created_at.asc&limit=100`),
          sb(`loop_run_artifacts?select=*&workspace_id=eq.${workspaceId}&run_id=eq.${encodeURIComponent(runId)}&order=created_at.desc`),
          sb(`loop_run_approvals?select=*&workspace_id=eq.${workspaceId}&run_id=eq.${encodeURIComponent(runId)}&order=created_at.desc`),
        ])
        res.status(200).json({ ok: true, run: Array.isArray(runs) ? (runs[0] || null) : null, assignments, events, artifacts, approvals })
        return
      }
      res.status(200).json({ ok: true, workspaceId, ...(await listState(workspaceId)), workerTokenConfigured: Boolean(WORKER_TOKEN) })
      return
    }

    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, message: 'Use GET or POST.' })
      return
    }

    const rawBody = parseBody(req.body)
    const action = rawBody && typeof rawBody.action === 'string' ? rawBody.action : null
    const workerActions = new Set(['lease','workerEvent','complete','fail','needsReview','blocked'])
    const operatorActions = new Set(['createRun','createApproval','approve','reject'])

    // Unknown/malformed actions still cross an authentication boundary before
    // receiving validation feedback. This keeps every operational mutation
    // fail-closed instead of exposing the action schema to anonymous callers.
    if (!action || (!workerActions.has(action) && !operatorActions.has(action))) {
      if (!workerAuthorized(req)) {
        const user = await authenticateSupabaseUser(req)
        if (!user) {
          res.status(401).json({ ok: false, message: 'Authentication required.' })
          return
        }
        if (!allowlistedEmail(user, process.env.LOOP_OPERATOR_EMAILS)) {
          res.status(403).json({ ok: false, message: 'Operator access is not configured for this account.' })
          return
        }
      }
      res.status(400).json({ ok: false, message: 'Invalid orchestrator request.' })
      return
    }

    if (workerActions.has(action) && !workerAuthorized(req)) {
      res.status(401).json({ ok: false, message: 'Worker token required.' })
      return
    }

    // Operator mutations always require an allowlisted human session. Worker
    // credentials are deliberately not accepted here, so workers cannot create
    // runs or resolve their own approval gates. An empty allowlist fails closed.
    let operatorUser: AuthenticatedUser | null = null
    let workspaceId: string | null = null
    if (operatorActions.has(action)) {
      operatorUser = await authenticateSupabaseUser(req)
      if (!operatorUser) {
        res.status(401).json({ ok: false, message: 'Sign in required to perform this action.' })
        return
      }
      if (!allowlistedEmail(operatorUser, process.env.LOOP_OPERATOR_EMAILS)) {
        res.status(403).json({ ok: false, message: 'Operator access is not configured for this account.' })
        return
      }
      workspaceId = (await workspaceForUser(req, operatorUser, true))?.workspaceId || null
    } else {
      workspaceId = workspaceForWorker(req)
    }
    const parsed = validate(OrchestratorActionSchema, rawBody)
    if (!parsed.success) {
      res.status(400).json({ ok: false, message: 'Invalid orchestrator request.' })
      return
    }
    if (!workspaceId) {
      res.status(403).json({ ok: false, message: 'Workspace access is required.' })
      return
    }
    const body = parsed.data as unknown as Record<string, unknown>

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      log.error('orchestrator_misconfigured', { hasUrl: Boolean(SUPABASE_URL), hasKey: Boolean(SUPABASE_SERVICE_ROLE_KEY) })
      res.status(503).json({ ok: false, message: 'Orchestrator is not configured.' })
      return
    }

    if (action === 'createRun') res.status(200).json({ ok: true, ...(await createProjectAndRun(workspaceId, body)) })
    else if (action === 'lease') res.status(200).json({ ok: true, ...(await lease(workspaceId, body)) })
    else if (action === 'workerEvent') res.status(200).json(await workerEvent(workspaceId, body))
    else if (action === 'complete') res.status(200).json({ ok: true, ...(await complete(workspaceId, body, 'done')) })
    else if (action === 'fail') res.status(200).json({ ok: true, ...(await complete(workspaceId, body, 'failed')) })
    else if (action === 'needsReview') res.status(200).json({ ok: true, ...(await complete(workspaceId, body, 'needs_review')) })
    else if (action === 'blocked') res.status(200).json({ ok: true, ...(await complete(workspaceId, body, 'blocked')) })
    else if (action === 'createApproval') res.status(200).json({ ok: true, ...(await createApproval(workspaceId, body)) })
    else if (action === 'approve') res.status(200).json({ ok: true, ...(await approve(workspaceId, body, 'approved', operatorUser as AuthenticatedUser)) })
    else if (action === 'reject') res.status(200).json({ ok: true, ...(await approve(workspaceId, body, 'rejected', operatorUser as AuthenticatedUser)) })
    else res.status(400).json({ ok: false, message: `Unknown action: ${action}` })
  } catch (error) {
    console.error('Orchestrator request failed', error)
    log.error('orchestrator_request_failed', { error: error instanceof Error ? error.message : String(error) })
    res.status(500).json({ ok: false, message: 'The orchestrator request could not be completed.' })
  }
}
