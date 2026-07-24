import { z } from 'zod'
import { workerTokenAuthorized } from './_auth.js'
import { workspaceForWorker } from './_workspace.js'

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

const NotifySchema = z.object({
  task: z.string().trim().min(10).max(4000),
  kind: z.enum(['agent-run','project','debug','dashboard','proposal']).optional(),
  priority: z.enum(['normal','high','urgent']).optional(),
  destination: z.enum(['auto','telegram','worker-webhook']).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

/** Authenticated internal notification relay. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('content-type', 'application/json; charset=utf-8')
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, message: 'Use POST to send a notification.' })
    return
  }
  if (!workerTokenAuthorized(req, process.env.ORCHESTRATOR_WORKER_TOKEN)) {
    res.status(401).json({ ok: false, message: 'Unauthorized.' })
    return
  }
  const workspaceId = workspaceForWorker(req)
  if (!workspaceId) {
    res.status(403).json({ ok: false, message: 'Workspace access is required.' })
    return
  }
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !key) {
    res.status(503).json({ ok: false, message: 'Notification queue is not configured.' })
    return
  }
  try {
    const candidate = typeof req.body === 'string' && req.body.length <= 50_000 ? JSON.parse(req.body) : req.body
    const parsed = NotifySchema.safeParse(candidate)
    if (!parsed.success) {
      res.status(400).json({ ok: false, message: 'Invalid notification payload.' })
      return
    }
    const body = parsed.data
    const response = await fetch(`${SUPABASE_URL}/rest/v1/loop_task_handoffs`, {
      method: 'POST',
      signal: AbortSignal.timeout(8_000),
      headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        workspace_id: workspaceId,
        task_id: `notify-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        task: body.task,
        kind: body.kind || 'dashboard',
        priority: body.priority || 'normal',
        destination: body.destination || 'auto',
        status: 'queued',
        delivery_message: null,
        process: [
          { label: 'Received', state: 'done', detail: 'Notification queued.' },
          { label: 'Deliver', state: 'pending', detail: 'Waiting for worker/bot to process.' },
        ],
        metadata: body.metadata || {},
      }),
    })
    if (!response.ok) throw new Error(`Queue write failed with HTTP ${response.status}`)
    res.status(200).json({ ok: true, message: 'Notification queued.' })
  } catch {
    res.status(500).json({ ok: false, message: 'Notification could not be queued.' })
  }
}
