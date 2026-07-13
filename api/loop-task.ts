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
const LOOP_TASK_WORKER_TOKEN = process.env.LOOP_TASK_WORKER_TOKEN || process.env.ORCHESTRATOR_WORKER_TOKEN
const WRITEBACK_STATUSES = new Set<TaskStatus>(['accepted', 'running', 'needs_review', 'done', 'failed', 'archived'])

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
      ...supabaseHeaders(init.headers && 'Prefer' in init.headers ? undefined : undefined),
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

async function sendTelegram(payload: { id: string; task: string; kind: string; priority: string }) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) throw new Error('Telegram env is missing')

  const text = [
    '<b>New Loop Engineering task</b>',
    `<b>ID:</b> <code>${escapeHtml(payload.id)}</code>`,
    `<b>Type:</b> ${escapeHtml(payload.kind)}`,
    `<b>Priority:</b> ${escapeHtml(payload.priority)}`,
    '',
    escapeHtml(payload.task),
  ].join('\n')

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


function headerValue(req: VercelRequest, key: string) {
  const found = req.headers[key] || req.headers[key.toLowerCase()]
  return Array.isArray(found) ? found[0] : found
}

function workerAuthorized(req: VercelRequest) {
  if (!LOOP_TASK_WORKER_TOKEN) return false
  const auth = headerValue(req, 'authorization')
  const token = headerValue(req, 'x-worker-token')
  return auth === `Bearer ${LOOP_TASK_WORKER_TOKEN}` || token === LOOP_TASK_WORKER_TOKEN
}

function processForWriteback(status: TaskStatus, summary?: string | null) {
  const doneLike = status === 'done'
  const failedLike = status === 'failed'
  const reviewLike = status === 'needs_review'
  const active = status === 'running' || status === 'accepted'
  return [
    step('Capture request', 'done', 'Task remains in the persistent Supabase queue.'),
    step('Validate scope', 'done', 'Writeback payload accepted.'),
    step('Route to bot / worker', 'done', 'Delivery channel already completed earlier or was skipped.'),
    step(
      'Run / wait for agent',
      doneLike || failedLike || reviewLike ? 'done' : active ? 'active' : 'pending',
      status === 'accepted'
        ? 'Worker/bot accepted the task.'
        : status === 'running'
          ? 'Worker/bot is actively executing the task.'
          : status === 'needs_review'
            ? 'Execution paused for human review.'
            : doneLike
              ? 'Agent finished successfully.'
              : failedLike
                ? (summary || 'Agent failed.')
                : 'Waiting for next status update.',
    ),
    step(
      'Verify & report back',
      doneLike ? 'done' : failedLike ? 'error' : reviewLike ? 'active' : 'pending',
      summary || (doneLike ? 'Result summary attached.' : failedLike ? 'Failure recorded.' : 'Awaiting further updates.'),
    ),
  ]
}

async function writeback(body: Record<string, unknown>) {
  const task_id = typeof body.taskId === 'string' ? body.taskId.trim() : ''
  if (!task_id) throw new Error('taskId required')
  const status = typeof body.status === 'string' && WRITEBACK_STATUSES.has(body.status as TaskStatus)
    ? body.status as TaskStatus
    : null
  if (!status) throw new Error('status must be one of accepted|running|needs_review|done|failed|archived')

  const result_summary = typeof body.resultSummary === 'string'
    ? body.resultSummary.trim().slice(0, 4000)
    : typeof body.summary === 'string'
      ? body.summary.trim().slice(0, 4000)
      : undefined
  const error = typeof body.error === 'string' ? body.error.trim().slice(0, 2000) : undefined
  const message = typeof body.message === 'string'
    ? body.message.trim().slice(0, 1000)
    : result_summary || `Task status set to ${status}.`
  const now = new Date().toISOString()
  const patch: Partial<StoredTask> = {
    status,
    process: processForWriteback(status, result_summary || error || message),
    delivery_message: message,
  }
  if (result_summary !== undefined) patch.result_summary = result_summary || null
  if (error !== undefined) patch.error = error || null
  if (status === 'accepted' || status === 'running') patch.claimed_at = now
  if (status === 'done' || status === 'failed' || status === 'archived') patch.completed_at = now

  const updated = await updateTask(task_id, patch)
  if (!updated) throw new Error(`Task not found: ${task_id}`)
  await insertEvent(task_id, `task_${status}`, message, {
    resultSummary: result_summary || null,
    error: error || null,
    actor: body.actor || 'worker',
  })
  return { task: updated }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('content-type', 'application/json; charset=utf-8')
  const readiness = deliveryReadiness()

  if (req.method === 'GET') {
    const taskIdParam = queryValue(req, 'taskId')
    if (taskIdParam) {
      const detail = await getTask(taskIdParam)
      res.status(200).json({ ok: true, deliveryReadiness: readiness, ...detail })
      return
    }
    const includeTasks = queryValue(req, 'includeTasks') === 'true'
    const tasks = includeTasks ? await listTasks() : []
    res.status(200).json({ ok: true, deliveryReadiness: readiness, tasks })
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, message: 'Use GET for status or POST to send a task.', deliveryReadiness: readiness })
    return
  }

  const body = asBody(req.body) as RequestBody & Record<string, unknown>
  const action = typeof body.action === 'string' ? body.action : 'create'

  if (action === 'writeback' || action === 'updateStatus') {
    if (!workerAuthorized(req)) {
      res.status(401).json({ ok: false, message: 'Worker token required for task writeback.', deliveryReadiness: readiness })
      return
    }
    try {
      const result = await writeback(body as Record<string, unknown>)
      res.status(200).json({ ok: true, deliveryReadiness: readiness, ...result })
    } catch (error) {
      res.status(400).json({ ok: false, deliveryReadiness: readiness, message: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const id = taskId()
  const task = typeof body.task === 'string' ? body.task.trim() : ''
  const kind = typeof body.kind === 'string' && validKinds.has(body.kind) ? body.kind : 'agent-run'
  const priority = typeof body.priority === 'string' && validPriorities.has(body.priority) ? body.priority : 'normal'
  const destination = typeof body.destination === 'string' && validDestinations.has(body.destination) ? body.destination as Destination : 'auto'
  const expectedResult = typeof body.expectedResult === 'string' ? body.expectedResult.trim().slice(0, 1000) : ''
  const contextUrl = typeof body.contextUrl === 'string' ? body.contextUrl.trim().slice(0, 1000) : ''

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
      metadata: { expectedResult, contextUrl },
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
      res.status(200).json({ ok: true, taskId: id, status, destination: resolved_destination, deliveryReadiness: readiness, message, process })
      return
    }

    if (destination === 'telegram' || (destination === 'auto' && readiness.telegramConfigured)) {
      const telegramMessageId = await sendTelegram({ id, task, kind, priority })
      status = 'delivered'
      resolved_destination = 'telegram'
      message = 'Task delivered to the configured Telegram bot/chat.'
      process = processForDelivered('telegram')
      await updateTask(id, { status, resolved_destination, delivery_message: message, process, telegram_message_id: telegramMessageId })
      await insertEvent(id, 'delivery_succeeded', message, { destination: resolved_destination, telegramMessageId })
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
