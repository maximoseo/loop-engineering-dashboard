type StepState = 'pending' | 'active' | 'done' | 'blocked' | 'error'
type Destination = 'auto' | 'telegram' | 'worker-webhook'
type TaskStatus = 'queued' | 'delivered' | 'accepted' | 'running' | 'needs_review' | 'done' | 'failed' | 'blocked_config' | 'archived'
type ResolvedDestination = 'pending' | 'telegram' | 'worker-webhook' | 'blocked' | 'failed'

type RequestBody = {
  task?: unknown
  kind?: unknown
  priority?: unknown
  destination?: unknown
  expectedResult?: unknown
  contextUrl?: unknown
  bot?: unknown
  model?: unknown
  effort?: unknown
  parentTaskId?: unknown
}

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

const validKinds = new Set(['agent-run', 'project', 'debug', 'dashboard', 'proposal'])
const validPriorities = new Set(['normal', 'high', 'urgent'])
const validDestinations = new Set(['auto', 'telegram', 'worker-webhook'])

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

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

function asBody(body: unknown): RequestBody {
  if (typeof body === 'string') {
    try { return JSON.parse(body) as RequestBody } catch { return {} }
  }
  return body && typeof body === 'object' ? body as RequestBody : {}
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
  await insertEvent(row.task_id, 'task_created', 'Task created in persistent queue.', { status: row.status })
  return json[0]
}

async function updateTask(task_id: string, patch: Partial<StoredTask>) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null
  const response = await fetch(`${SUPABASE_URL}/rest/v1/loop_task_handoffs?task_id=eq.${encodeURIComponent(task_id)}`, {
    method: 'PATCH',
    headers: supabaseHeaders('return=representation'),
    body: JSON.stringify(patch),
  })
  if (!response.ok) throw new Error(`Supabase update task: HTTP ${response.status} ${(await response.text()).slice(0, 160)}`)
  const json = await response.json() as StoredTask[]
  return json[0]
}

async function insertEvent(task_id: string, event_type: string, message: string, metadata: Record<string, unknown> = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return
  const response = await fetch(`${SUPABASE_URL}/rest/v1/loop_task_events`, {
    method: 'POST',
    headers: supabaseHeaders(),
    body: JSON.stringify({ task_id, event_type, message, metadata }),
  })
  if (!response.ok) throw new Error(`Supabase insert event: HTTP ${response.status} ${(await response.text()).slice(0, 160)}`)
}

async function listTasks(limit = 12) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return []
  const response = await supabaseFetch(`loop_task_handoffs?select=*&status=neq.archived&order=created_at.desc&limit=${limit}`)
  return (await response.json()) as StoredTask[]
}

async function getTask(task_id: string) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return { tasks: [], events: [] }
  const [taskResponse, eventResponse] = await Promise.all([
    supabaseFetch(`loop_task_handoffs?select=*&task_id=eq.${encodeURIComponent(task_id)}&limit=1`),
    supabaseFetch(`loop_task_events?select=*&task_id=eq.${encodeURIComponent(task_id)}&order=created_at.asc`),
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
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  })
  const json = await response.json() as { ok?: boolean; result?: { message_id?: number }; description?: string }
  if (!response.ok || !json.ok) throw new Error(`Telegram HTTP ${response.status}: ${json.description || 'send failed'}`)
  return json.result?.message_id ? String(json.result.message_id) : null
}

async function sendWebhook(payload: { id: string; task: string; kind: string; priority: string; destination: Destination }) {
  const url = process.env.LOOP_TASK_WEBHOOK_URL
  if (!url) throw new Error('Webhook env is missing')
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (process.env.LOOP_TASK_WEBHOOK_SECRET) headers.authorization = `Bearer ${process.env.LOOP_TASK_WEBHOOK_SECRET}`
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...payload, source: 'loop-engineering-dashboard', createdAt: new Date().toISOString() }),
  })
  if (!response.ok) throw new Error(`Webhook HTTP ${response.status}`)
}

// Kick the worker so a freshly-submitted task starts processing within seconds
// instead of waiting for the next cron tick. Best-effort: the request reaches a
// separate /api/worker invocation that runs to completion on its own; we only
// wait long enough to hand it off, and the every-minute cron is the backstop.
async function kickWorker(req: VercelRequest) {
  const secret = process.env.WORKER_SECRET
  const host = (req.headers['x-forwarded-host'] as string) || (req.headers.host as string)
  if (!secret || !host) return
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https'
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

// Verify a Supabase session token against the Auth API. Returns the user's
// identity, or null when the token is missing/invalid/expired.
async function verifySession(token: string): Promise<{ email?: string } | null> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  if (!token || !supabaseUrl) return null
  try {
    const r = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY || '', authorization: `Bearer ${token}` },
    })
    if (!r.ok) return null
    return await r.json() as { email?: string }
  } catch { return null }
}

function bearerToken(req: VercelRequest): string {
  const authHeader = Array.isArray(req.headers.authorization) ? req.headers.authorization[0] : req.headers.authorization
  return (authHeader || '').replace('Bearer ', '')
}

type GateResult = { ok: true; email?: string } | { ok: false; status: number; message: string }

// Role gate: which callers may read/submit tasks. Fail-closed — every caller must
// present a valid Supabase session, and an empty/unset LOOP_OPERATOR_EMAILS
// allowlist denies everyone (no operators configured means no access).
async function operatorGate(req: VercelRequest): Promise<GateResult> {
  const token = bearerToken(req)
  if (!token) return { ok: false, status: 401, message: 'Authentication required. Provide a Supabase session token.' }
  const session = await verifySession(token)
  if (!session) return { ok: false, status: 401, message: 'Invalid or expired session.' }
  const allow = (process.env.LOOP_OPERATOR_EMAILS || '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  if (allow.length === 0) return { ok: false, status: 403, message: 'No operators configured.' }
  if (!session.email || !allow.includes(session.email.toLowerCase())) {
    return { ok: false, status: 403, message: 'You are not authorized to submit tasks (operator access required).' }
  }
  return { ok: true, email: session.email }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('content-type', 'application/json; charset=utf-8')

  // Rate limiting for POST (task submission)
  if (req.method === 'POST') {
    const clientId = getClientIdentifier(req)
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
    const includeTasks = queryValue(req, 'includeTasks') === 'true'
    // Task data (queue list or a single task's detail) is operator-only; the bare
    // health/readiness probe stays public so uptime checks keep working.
    if (taskIdParam || includeTasks) {
      const gate = await operatorGate(req)
      if (!gate.ok) {
        res.status(gate.status).json({ ok: false, message: gate.message, deliveryReadiness: readiness })
        return
      }
      if (taskIdParam) {
        const detail = await getTask(taskIdParam)
        res.status(200).json({ ok: true, deliveryReadiness: readiness, ...detail })
        return
      }
      const tasks = await listTasks()
      res.status(200).json({ ok: true, deliveryReadiness: readiness, tasks })
      return
    }
    res.status(200).json({ ok: true, deliveryReadiness: readiness, tasks: [] })
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, message: 'Use GET for status or POST to send a task.', deliveryReadiness: readiness })
    return
  }

  // Role gate (fail-closed): the caller must present a valid Supabase session
  // whose email is on the LOOP_OPERATOR_EMAILS allowlist. An empty allowlist
  // denies everyone, and a missing/invalid session is rejected with 401.
  const gate = await operatorGate(req)
  if (!gate.ok) {
    res.status(gate.status).json({ ok: false, message: gate.message })
    return
  }

  const id = taskId()
  const body = asBody(req.body)
  const task = typeof body.task === 'string' ? body.task.trim() : ''
  const kind = typeof body.kind === 'string' && validKinds.has(body.kind) ? body.kind : 'agent-run'
  const priority = typeof body.priority === 'string' && validPriorities.has(body.priority) ? body.priority : 'normal'
  const destination = typeof body.destination === 'string' && validDestinations.has(body.destination) ? body.destination as Destination : 'auto'
  const expectedResult = typeof body.expectedResult === 'string' ? body.expectedResult.trim().slice(0, 1000) : ''
  const contextUrl = typeof body.contextUrl === 'string' ? body.contextUrl.trim().slice(0, 1000) : ''
  const bot = typeof body.bot === 'string' ? body.bot.trim().slice(0, 60) : ''
  const model = typeof body.model === 'string' ? body.model.trim().slice(0, 60) : ''
  const validEfforts = new Set(['low', 'medium', 'high', 'max'])
  const effort = typeof body.effort === 'string' && validEfforts.has(body.effort) ? body.effort : ''
  const parentTaskId = typeof body.parentTaskId === 'string' ? body.parentTaskId.trim().slice(0, 80) : ''

  if (task.length < 10 || task.length > 4000) {
    const process = processForInvalidInput()
    res.status(400).json({ ok: false, taskId: id, status: 'failed', destination, deliveryReadiness: readiness, message: 'Task must be between 10 and 4000 characters.', process })
    return
  }

  let status: TaskStatus = readiness.publicDeliveryEnabled ? 'queued' : 'blocked_config'
  let resolved_destination: ResolvedDestination = 'pending'
  let message = readiness.publicDeliveryEnabled ? 'Task queued for delivery.' : 'Backend intake is installed, but public task delivery is disabled.'
  let process = readiness.publicDeliveryEnabled ? processForMissingChannel() : processForDisabledDelivery()

  try {
    await insertTask({
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
    res.status(500).json({ ok: false, taskId: id, status: 'failed', destination, deliveryReadiness: readiness, message: error instanceof Error ? error.message : String(error), process })
    return
  }

  if (!readiness.publicDeliveryEnabled) {
    await insertEvent(id, 'delivery_blocked', message, { reason: 'public_delivery_disabled' })
    res.status(202).json({ ok: false, taskId: id, status, destination, deliveryReadiness: readiness, message, process })
    return
  }

  try {
    if (destination === 'worker-webhook' || (destination === 'auto' && readiness.webhookConfigured)) {
      await sendWebhook({ id, task, kind, priority, destination })
      status = 'delivered'
      resolved_destination = 'worker-webhook'
      message = 'Task delivered to the configured worker webhook.'
      process = processForDelivered('worker-webhook')
      await updateTask(id, { status, resolved_destination, delivery_message: message, process })
      await insertEvent(id, 'delivery_succeeded', message, { destination: resolved_destination })
      await kickWorker(req)
      res.status(200).json({ ok: true, taskId: id, status, destination: resolved_destination, deliveryReadiness: readiness, message, process })
      return
    }

    if (destination === 'telegram' || (destination === 'auto' && readiness.telegramConfigured)) {
      const telegramMessageId = await sendTelegram({ id, task, kind, priority, bot, model, effort })
      status = 'delivered'
      resolved_destination = 'telegram'
      message = 'Task delivered to the configured Telegram bot/chat.'
      process = processForDelivered('telegram')
      await updateTask(id, { status, resolved_destination, delivery_message: message, process, telegram_message_id: telegramMessageId })
      await insertEvent(id, 'delivery_succeeded', message, { destination: resolved_destination, telegramMessageId })
      await kickWorker(req)
      res.status(200).json({ ok: true, taskId: id, status, destination: resolved_destination, deliveryReadiness: readiness, message, process })
      return
    }

    status = 'blocked_config'
    resolved_destination = 'blocked'
    message = 'No delivery channel is configured. Add LOOP_TASK_WEBHOOK_URL or TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID in Vercel.'
    process = processForMissingChannel()
    await updateTask(id, { status, resolved_destination, delivery_message: message, process })
    await insertEvent(id, 'delivery_blocked', message, { reason: 'missing_channel' })
    res.status(202).json({ ok: false, taskId: id, status, destination, deliveryReadiness: readiness, message, process })
  } catch (error) {
    status = 'failed'
    resolved_destination = 'failed'
    message = error instanceof Error ? error.message : String(error)
    process = [
      step('Capture request', 'done', 'Request saved to the persistent task queue.'),
      step('Validate scope', 'done', 'Payload is valid and scoped.'),
      step('Route to bot / worker', 'error', message),
      step('Run / wait for agent', 'blocked', 'Delivery failed before the worker accepted the task.'),
      step('Verify & report back', 'blocked', 'Check provider logs and env.'),
    ]
    await updateTask(id, { status, resolved_destination, delivery_message: message, process, error: message })
    await insertEvent(id, 'delivery_failed', message, { destination })
    res.status(502).json({ ok: false, taskId: id, status, destination, deliveryReadiness: readiness, message, process })
  }
}
