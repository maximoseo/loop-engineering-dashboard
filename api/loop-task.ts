import { allowlistedEmail, authenticateSupabaseUser } from './_auth.js'
import { LoopTaskCreateSchema, validate } from './schemas.js'
import { log } from './logger.js'
import { workspaceForUser } from './_workspace.js'

type StepState = 'pending' | 'active' | 'done' | 'blocked' | 'error'
type Destination = 'auto' | 'telegram' | 'worker-webhook'
type TaskStatus = 'queued' | 'delivered' | 'accepted' | 'running' | 'needs_review' | 'done' | 'failed' | 'blocked_config' | 'archived'
type ResolvedDestination = 'pending' | 'telegram' | 'worker-webhook' | 'blocked' | 'failed'

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

// Rate limiter — inlined (was ./rate-limit). A relative ESM import without a
// file extension fails to resolve in the Vercel Node runtime (ERR_MODULE_NOT_FOUND),
// which crashed this whole function; inlining removes that dependency.
const RL_WINDOW_MS = 60_000
const RL_MAX = 20
const rlBuckets = new Map<string, { count: number; resetAt: number }>()

function rateLimit(identifier: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now()
  // Evict expired buckets so a flood of unique clients can't grow the map without bound.
  if (rlBuckets.size > 5000) {
    for (const [key, bucket] of rlBuckets) if (now > bucket.resetAt) rlBuckets.delete(key)
  }
  const existing = rlBuckets.get(identifier)
  if (!existing || now > existing.resetAt) {
    rlBuckets.set(identifier, { count: 1, resetAt: now + RL_WINDOW_MS })
    return { allowed: true, remaining: RL_MAX - 1, resetIn: RL_WINDOW_MS }
  }
  existing.count++
  if (existing.count > RL_MAX) return { allowed: false, remaining: 0, resetIn: existing.resetAt - now }
  return { allowed: true, remaining: RL_MAX - existing.count, resetIn: existing.resetAt - now }
}

function getClientIdentifier(req: { headers: Record<string, string | string[] | undefined> }): string {
  const forwarded = req.headers['x-forwarded-for']
  const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]?.trim()
  return ip || 'unknown'
}

interface ProcessStep {
  label: string
  state: StepState
  detail: string
}

interface StoredTask {
  workspace_id: string
  task_id: string
  task: string
  kind: string
  priority: string
  destination: string
  resolved_destination: ResolvedDestination
  status: TaskStatus
  delivery_message: string | null
  process: ProcessStep[]
  result_summary: string | null
  telegram_message_id: string | null
  created_at: string
  updated_at: string
  claimed_at: string | null
  completed_at: string | null
  error: string | null
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

function operatorEmails() {
  return process.env.LOOP_OPERATOR_EMAILS
}

function deliveryReadiness() {
  const publicDeliveryEnabled = process.env.LOOP_TASK_PUBLIC_ENABLED === 'true'
  const telegramConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID)
  const webhookConfigured = Boolean(process.env.LOOP_TASK_WEBHOOK_URL)
  const queueConfigured = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  const defaultRoute = !publicDeliveryEnabled
    ? 'blocked_config'
    : webhookConfigured
      ? 'worker-webhook'
      : telegramConfigured
        ? 'telegram'
        : 'blocked_config'

  return {
    api: 'ready',
    publicDeliveryEnabled,
    telegramConfigured,
    webhookConfigured,
    queueConfigured,
    defaultRoute,
  }
}

function step(label: string, state: StepState, detail: string): ProcessStep {
  return { label, state, detail }
}

function taskId() {
  const suffix = Math.random().toString(36).slice(2, 8)
  return `loop-task-${Date.now()}-${suffix}`
}

function queryValue(req: VercelRequest, key: string): string | undefined {
  const value = req.query?.[key]
  return Array.isArray(value) ? value[0] : value
}

function escapeHtml(input: string) {
  return input.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function processForInvalidInput() {
  return [
    step('Capture request', 'done', 'Request reached the backend intake endpoint.'),
    step('Validate scope', 'error', 'Task text must be between 10 and 4000 characters.'),
    step('Route to bot / worker', 'blocked', 'Nothing was delivered.'),
    step('Run / wait for agent', 'blocked', 'Agent run did not start.'),
    step('Verify & report back', 'blocked', 'Fix the task text and send again.'),
  ]
}

function processForDisabledDelivery() {
  return [
    step('Capture request', 'done', 'Request saved to the persistent task queue.'),
    step('Validate scope', 'done', 'Payload is valid and ready for routing.'),
    step('Route to bot / worker', 'blocked', 'Delivery is disabled by Vercel env.'),
    step('Run / wait for agent', 'blocked', 'No bot or worker run was started.'),
    step('Verify & report back', 'blocked', 'Enable delivery env before tasks can run behind the scenes.'),
  ]
}

function processForMissingChannel() {
  return [
    step('Capture request', 'done', 'Request saved to the persistent task queue.'),
    step('Validate scope', 'done', 'Payload is valid and scoped.'),
    step('Route to bot / worker', 'blocked', 'No Telegram or webhook destination exists.'),
    step('Run / wait for agent', 'blocked', 'No bot or worker accepted the task.'),
    step('Verify & report back', 'blocked', 'Configure a delivery channel and send again.'),
  ]
}

function processForDelivered(channel: 'telegram' | 'worker-webhook') {
  return [
    step('Capture request', 'done', 'Request saved to the persistent Supabase queue.'),
    step('Validate scope', 'done', 'Payload is valid and scoped.'),
    step('Route to bot / worker', 'done', channel === 'telegram' ? 'Telegram accepted the task.' : 'Webhook accepted the task.'),
    step('Run / wait for agent', 'active', 'The external bot/worker now owns execution and follow-up.'),
    step('Verify & report back', 'pending', 'Wait for the agent result, then verify the dashboard/output.'),
  ]
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

async function supabaseFetch(path: string, init: RequestInit = {}) {
  if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL')
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...supabaseHeaders(),
      ...(init.headers || {}),
    },
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Supabase ${path}: HTTP ${response.status} ${body.slice(0, 160)}`)
  }
  return response
}

async function insertTask(row: {
  workspace_id: string
  task_id: string
  task: string
  kind: string
  priority: string
  destination: Destination
  status: TaskStatus
  resolved_destination: ResolvedDestination
  delivery_message: string | null
  process: ProcessStep[]
  error?: string | null
  metadata?: Record<string, unknown>
}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null
  const response = await fetch(`${SUPABASE_URL}/rest/v1/loop_task_handoffs`, {
    method: 'POST',
    headers: supabaseHeaders('return=representation'),
    body: JSON.stringify(row),
  })
  if (!response.ok) throw new Error(`Supabase insert task: HTTP ${response.status} ${(await response.text()).slice(0, 160)}`)
  const json = await response.json() as StoredTask[]
  await insertEvent(row.workspace_id, row.task_id, 'task_created', 'Task created in persistent queue.', { status: row.status })
  return json[0]
}

async function updateTask(workspace_id: string, task_id: string, patch: Partial<StoredTask>) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null
  const response = await fetch(`${SUPABASE_URL}/rest/v1/loop_task_handoffs?workspace_id=eq.${encodeURIComponent(workspace_id)}&task_id=eq.${encodeURIComponent(task_id)}`, {
    method: 'PATCH',
    headers: supabaseHeaders('return=representation'),
    body: JSON.stringify(patch),
  })
  if (!response.ok) throw new Error(`Supabase update task: HTTP ${response.status} ${(await response.text()).slice(0, 160)}`)
  const json = await response.json() as StoredTask[]
  return json[0]
}

async function insertEvent(workspace_id: string, task_id: string, event_type: string, message: string, metadata: Record<string, unknown> = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return
  const response = await fetch(`${SUPABASE_URL}/rest/v1/loop_task_events`, {
    method: 'POST',
    headers: supabaseHeaders(),
    body: JSON.stringify({ workspace_id, task_id, event_type, message, metadata }),
  })
  if (!response.ok) throw new Error(`Supabase insert event: HTTP ${response.status} ${(await response.text()).slice(0, 160)}`)
}

async function listTasks(workspace_id: string, limit = 12) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return []
  const response = await supabaseFetch(`loop_task_handoffs?select=*&workspace_id=eq.${encodeURIComponent(workspace_id)}&status=neq.archived&order=created_at.desc&limit=${limit}`)
  return (await response.json()) as StoredTask[]
}

async function getTask(workspace_id: string, task_id: string) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return { tasks: [], events: [] }
  const [taskResponse, eventResponse] = await Promise.all([
    supabaseFetch(`loop_task_handoffs?select=*&workspace_id=eq.${encodeURIComponent(workspace_id)}&task_id=eq.${encodeURIComponent(task_id)}&limit=1`),
    supabaseFetch(`loop_task_events?select=*&workspace_id=eq.${encodeURIComponent(workspace_id)}&task_id=eq.${encodeURIComponent(task_id)}&order=created_at.asc`),
  ])
  return { tasks: await taskResponse.json(), events: await eventResponse.json() }
}

async function sendTelegram(payload: { id: string; task: string; kind: string; priority: string; bot?: string; model?: string; effort?: string }) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) throw new Error('Telegram env is missing')

  const text = [
    '<b>New Loop Engineering task</b>',
    `<b>ID:</b> <code>${escapeHtml(payload.id)}</code>`,
    `<b>Type:</b> ${escapeHtml(payload.kind)}`,
    `<b>Priority:</b> ${escapeHtml(payload.priority)}`,
    payload.bot ? `<b>Bot:</b> ${escapeHtml(payload.bot)}` : '',
    payload.model ? `<b>Model:</b> ${escapeHtml(payload.model)}` : '',
    payload.effort ? `<b>Effort:</b> ${escapeHtml(payload.effort)}` : '',
    '',
    escapeHtml(payload.task),
  ].filter(Boolean).join('\n')

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    signal: AbortSignal.timeout(8_000),
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  })
  const json = await response.json() as { ok?: boolean; result?: { message_id?: number }; description?: string }
  if (!response.ok || !json.ok) throw new Error(`Telegram HTTP ${response.status}: ${json.description || 'send failed'}`)
  return json.result?.message_id ? String(json.result.message_id) : null
}

async function sendWebhook(payload: { workspaceId: string; id: string; task: string; kind: string; priority: string; destination: Destination }) {
  const url = process.env.LOOP_TASK_WEBHOOK_URL
  if (!url) throw new Error('Webhook env is missing')
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (process.env.LOOP_TASK_WEBHOOK_SECRET) headers.authorization = `Bearer ${process.env.LOOP_TASK_WEBHOOK_SECRET}`
  const response = await fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(8_000),
    headers,
    body: JSON.stringify({ ...payload, source: 'loop-engineering-dashboard', createdAt: new Date().toISOString() }),
  })
  if (!response.ok) throw new Error(`Webhook HTTP ${response.status}`)
}

// Kick the worker so a freshly-submitted task starts processing within seconds
// instead of waiting for the next cron tick. Best-effort: the request reaches a
// separate /api/worker invocation that runs to completion on its own; we only
// wait long enough to hand it off, and the every-minute cron is the backstop.
async function kickWorker() {
  const secret = process.env.WORKER_SECRET
  const host = process.env.VERCEL_URL
  if (!secret || !host) return
  const proto = 'https'
  try {
    // Short hand-off: the request reaches a separate /api/worker invocation that
    // runs to completion on its own; we only wait long enough to send it so the
    // POST response (and the dashboard's "delivered" state) is not held up.
    // Secret goes in a header, not the URL, to keep it out of access logs.
    await fetch(`${proto}://${host}/api/worker`, {
      headers: { 'x-worker-secret': secret },
      signal: AbortSignal.timeout(800),
    })
  } catch { /* handed off (or cron will pick it up) */ }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('content-type', 'application/json; charset=utf-8')

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ ok: false, message: 'Use GET for status or POST to send a task.' })
    return
  }

  const user = await authenticateSupabaseUser(req)
  if (!user) {
    res.status(401).json({ ok: false, message: 'Authentication required.' })
    return
  }

  // Task readiness, queue details, and submission are operational data. Keep
  // both reads and writes scoped to the configured operators; empty fails closed.
  if (!allowlistedEmail(user, operatorEmails())) {
    res.status(403).json({ ok: false, message: 'Operator access is not configured for this account.' })
    return
  }
  const workspace = await workspaceForUser(req, user, req.method === 'POST')
  if (!workspace) {
    res.status(403).json({ ok: false, message: 'Workspace access is required.' })
    return
  }

  // Rate limiting for POST (task submission)
  if (req.method === 'POST') {
    const clientId = `${workspace.workspaceId}:${user.id}:${getClientIdentifier(req)}`
    const limit = rateLimit(clientId)
    if (!limit.allowed) {
      res.status(429).json({
        ok: false,
        message: `Rate limit exceeded. Try again in ${Math.ceil(limit.resetIn / 1000)}s.`,
        retryAfter: Math.ceil(limit.resetIn / 1000),
      })
      return
    }
  }

  const readiness = deliveryReadiness()

  if (req.method === 'GET') {
    const taskIdParam = queryValue(req, 'taskId')
    if (taskIdParam) {
      const detail = await getTask(workspace.workspaceId, taskIdParam)
      res.status(200).json({ ok: true, deliveryReadiness: readiness, ...detail })
      return
    }
    const includeTasks = queryValue(req, 'includeTasks') === 'true'
    const tasks = includeTasks ? await listTasks(workspace.workspaceId) : []
    res.status(200).json({ ok: true, workspaceId: workspace.workspaceId, deliveryReadiness: readiness, tasks })
    return
  }

  const id = taskId()
  let candidate = req.body
  if (typeof candidate === 'string') {
    try { candidate = JSON.parse(candidate) } catch { candidate = null }
  }
  if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
    const record = candidate as Record<string, unknown>
    if (typeof record.task === 'string') candidate = { ...record, task: record.task.trim() }
  }
  const parsed = validate(LoopTaskCreateSchema, candidate)
  if (!parsed.success) {
    const process = processForInvalidInput()
    res.status(400).json({ ok: false, taskId: id, status: 'failed', destination: 'auto', deliveryReadiness: readiness, message: parsed.error, process })
    return
  }
  const data = parsed.data
  const task = data.task.trim()
  const kind = data.kind ?? 'agent-run'
  const priority = data.priority ?? 'normal'
  const destination = (data.destination ?? 'auto') as Destination
  const expectedResult = (data.expectedResult ?? '').trim()
  const contextUrl = (data.contextUrl ?? '').trim()
  const bot = (data.bot ?? '').trim()
  const model = (data.model ?? '').trim()
  const effort = data.effort ?? ''
  const parentTaskId = (data.parentTaskId ?? '').trim()

  log.info('task_received', { taskId: id, kind, priority, destination, hasContext: Boolean(contextUrl) })

  let status: TaskStatus = readiness.publicDeliveryEnabled ? 'queued' : 'blocked_config'
  let resolved_destination: ResolvedDestination = 'pending'
  let message = readiness.publicDeliveryEnabled ? 'Task queued for delivery.' : 'Backend intake is installed, but public task delivery is disabled.'
  let process = readiness.publicDeliveryEnabled ? processForMissingChannel() : processForDisabledDelivery()

  try {
    await insertTask({
      workspace_id: workspace.workspaceId,
      task_id: id,
      task,
      kind,
      priority,
      destination,
      status,
      resolved_destination,
      delivery_message: message,
      process,
      metadata: { expectedResult, contextUrl, bot, model, effort, ...(parentTaskId ? { parent_task_id: parentTaskId } : {}) },
    })
  } catch (error) {
    console.error('Task persistence failed', error)
    res.status(500).json({ ok: false, taskId: id, status: 'failed', destination, deliveryReadiness: readiness, message: 'Unable to save the task.', process })
    return
  }

  if (!readiness.publicDeliveryEnabled) {
    await insertEvent(workspace.workspaceId, id, 'delivery_blocked', message, { reason: 'public_delivery_disabled' })
    res.status(202).json({ ok: false, taskId: id, status, destination, deliveryReadiness: readiness, message, process })
    return
  }

  try {
    if (destination === 'worker-webhook' || (destination === 'auto' && readiness.webhookConfigured)) {
      await sendWebhook({ workspaceId: workspace.workspaceId, id, task, kind, priority, destination })
      status = 'delivered'
      resolved_destination = 'worker-webhook'
      message = 'Task delivered to the configured worker webhook.'
      process = processForDelivered('worker-webhook')
      await updateTask(workspace.workspaceId, id, { status, resolved_destination, delivery_message: message, process })
      await insertEvent(workspace.workspaceId, id, 'delivery_succeeded', message, { destination: resolved_destination })
      await kickWorker()
      res.status(200).json({ ok: true, taskId: id, status, destination: resolved_destination, deliveryReadiness: readiness, message, process })
      return
    }

    if (destination === 'telegram' || (destination === 'auto' && readiness.telegramConfigured)) {
      const telegramMessageId = await sendTelegram({ id, task, kind, priority, bot, model, effort })
      status = 'delivered'
      resolved_destination = 'telegram'
      message = 'Task delivered to the configured Telegram bot/chat.'
      process = processForDelivered('telegram')
      await updateTask(workspace.workspaceId, id, { status, resolved_destination, delivery_message: message, process, telegram_message_id: telegramMessageId })
      log.info('delivery_succeeded', { taskId: id, destination: resolved_destination })
      await insertEvent(workspace.workspaceId, id, 'delivery_succeeded', message, { destination: resolved_destination, telegramMessageId })
      await kickWorker()
      res.status(200).json({ ok: true, taskId: id, status, destination: resolved_destination, deliveryReadiness: readiness, message, process })
      return
    }

    status = 'blocked_config'
    resolved_destination = 'blocked'
    message = 'No delivery channel is configured. Add LOOP_TASK_WEBHOOK_URL or TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID in Vercel.'
    process = processForMissingChannel()
    await updateTask(workspace.workspaceId, id, { status, resolved_destination, delivery_message: message, process })
    await insertEvent(workspace.workspaceId, id, 'delivery_blocked', message, { reason: 'missing_channel' })
    res.status(202).json({ ok: false, taskId: id, status, destination, deliveryReadiness: readiness, message, process })
  } catch (error) {
    console.error('Task delivery failed', error)
    log.error('delivery_failed', { taskId: id, destination, error: error instanceof Error ? error.message : String(error) })
    status = 'failed'
    resolved_destination = 'failed'
    message = 'Task delivery failed before the worker accepted it.'
    process = [
      step('Capture request', 'done', 'Request saved to the persistent task queue.'),
      step('Validate scope', 'done', 'Payload is valid and scoped.'),
      step('Route to bot / worker', 'error', message),
      step('Run / wait for agent', 'blocked', 'Delivery failed before the worker accepted the task.'),
      step('Verify & report back', 'blocked', 'Check server logs and delivery configuration.'),
    ]
    try {
      await updateTask(workspace.workspaceId, id, { status, resolved_destination, delivery_message: message, process, error: message })
      await insertEvent(workspace.workspaceId, id, 'delivery_failed', message, { destination })
    } catch (persistenceError) {
      console.error('Unable to persist task delivery failure', persistenceError)
    }
    res.status(502).json({ ok: false, taskId: id, status, destination, deliveryReadiness: readiness, message, process })
  }
}
