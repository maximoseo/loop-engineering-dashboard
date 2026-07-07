type StepState = 'pending' | 'active' | 'done' | 'blocked' | 'error'

type Destination = 'auto' | 'telegram' | 'worker-webhook'

type RequestBody = {
  task?: unknown
  kind?: unknown
  priority?: unknown
  destination?: unknown
}

type VercelRequest = {
  method?: string
  body?: unknown
  headers: Record<string, string | string[] | undefined>
}

type VercelResponse = {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
  setHeader: (name: string, value: string) => void
}

const validKinds = new Set(['agent-run', 'project', 'debug', 'dashboard', 'proposal'])
const validPriorities = new Set(['normal', 'high', 'urgent'])
const validDestinations = new Set(['auto', 'telegram', 'worker-webhook'])

function step(label: string, state: StepState, detail: string) {
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

function escapeHtml(input: string) {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
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

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  })
  if (!res.ok) throw new Error(`Telegram HTTP ${res.status}`)
}

async function sendWebhook(payload: { id: string; task: string; kind: string; priority: string; destination: Destination }) {
  const url = process.env.LOOP_TASK_WEBHOOK_URL
  if (!url) throw new Error('Webhook env is missing')
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (process.env.LOOP_TASK_WEBHOOK_SECRET) {
    headers.authorization = `Bearer ${process.env.LOOP_TASK_WEBHOOK_SECRET}`
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...payload, source: 'loop-engineering-dashboard', createdAt: new Date().toISOString() }),
  })
  if (!res.ok) throw new Error(`Webhook HTTP ${res.status}`)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('content-type', 'application/json; charset=utf-8')

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, message: 'Use POST' })
    return
  }

  const id = taskId()
  const body = asBody(req.body)
  const task = typeof body.task === 'string' ? body.task.trim() : ''
  const kind = typeof body.kind === 'string' && validKinds.has(body.kind) ? body.kind : 'agent-run'
  const priority = typeof body.priority === 'string' && validPriorities.has(body.priority) ? body.priority : 'normal'
  const destination = typeof body.destination === 'string' && validDestinations.has(body.destination)
    ? body.destination as Destination
    : 'auto'

  if (task.length < 10 || task.length > 4000) {
    res.status(400).json({
      ok: false,
      taskId: id,
      status: 'failed',
      destination,
      message: 'Task must be between 10 and 4000 characters.',
      process: [
        step('Capture request', 'done', 'Request reached the backend intake endpoint.'),
        step('Validate scope', 'error', 'Task text length is invalid.'),
        step('Send to bot / worker', 'blocked', 'Nothing was delivered.'),
        step('Track process', 'blocked', 'Fix the task text and send again.'),
      ],
    })
    return
  }

  if (process.env.LOOP_TASK_PUBLIC_ENABLED !== 'true') {
    res.status(202).json({
      ok: false,
      taskId: id,
      status: 'blocked_config',
      destination,
      message: 'Backend intake is installed, but public task delivery is disabled. Set LOOP_TASK_PUBLIC_ENABLED=true after choosing Telegram or webhook delivery.',
      process: [
        step('Capture request', 'done', 'Request reached the backend intake endpoint.'),
        step('Validate scope', 'done', 'Payload is valid and ready for routing.'),
        step('Send to bot / worker', 'blocked', 'Delivery is disabled by Vercel env.'),
        step('Track process', 'blocked', 'Operator must enable delivery env before tasks can run behind the scenes.'),
      ],
    })
    return
  }

  const hasWebhook = Boolean(process.env.LOOP_TASK_WEBHOOK_URL)
  const hasTelegram = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID)
  const payload = { id, task, kind, priority, destination }

  try {
    if (destination === 'worker-webhook' || (destination === 'auto' && hasWebhook)) {
      await sendWebhook(payload)
      res.status(200).json({
        ok: true,
        taskId: id,
        status: 'delivered',
        destination: 'worker-webhook',
        message: 'Task delivered to the configured worker webhook.',
        process: [
          step('Capture request', 'done', 'Request reached the backend intake endpoint.'),
          step('Validate scope', 'done', 'Payload is valid and scoped.'),
          step('Send to bot / worker', 'done', 'Webhook accepted the task.'),
          step('Track process', 'done', 'Task id returned to the dashboard.'),
        ],
      })
      return
    }

    if (destination === 'telegram' || (destination === 'auto' && hasTelegram)) {
      await sendTelegram(payload)
      res.status(200).json({
        ok: true,
        taskId: id,
        status: 'delivered',
        destination: 'telegram',
        message: 'Task delivered to the configured Telegram bot/chat.',
        process: [
          step('Capture request', 'done', 'Request reached the backend intake endpoint.'),
          step('Validate scope', 'done', 'Payload is valid and scoped.'),
          step('Send to bot / worker', 'done', 'Telegram accepted the task.'),
          step('Track process', 'done', 'Task id returned to the dashboard.'),
        ],
      })
      return
    }

    res.status(202).json({
      ok: false,
      taskId: id,
      status: 'blocked_config',
      destination,
      message: 'No delivery channel is configured. Add LOOP_TASK_WEBHOOK_URL or TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID in Vercel.',
      process: [
        step('Capture request', 'done', 'Request reached the backend intake endpoint.'),
        step('Validate scope', 'done', 'Payload is valid and scoped.'),
        step('Send to bot / worker', 'blocked', 'No Telegram or webhook destination exists.'),
        step('Track process', 'blocked', 'Task was not delivered; configure a delivery channel.'),
      ],
    })
  } catch (error) {
    res.status(502).json({
      ok: false,
      taskId: id,
      status: 'failed',
      destination,
      message: error instanceof Error ? error.message : String(error),
      process: [
        step('Capture request', 'done', 'Request reached the backend intake endpoint.'),
        step('Validate scope', 'done', 'Payload is valid and scoped.'),
        step('Send to bot / worker', 'error', error instanceof Error ? error.message : String(error)),
        step('Track process', 'blocked', 'Delivery failed; check provider logs and env.'),
      ],
    })
  }
}
