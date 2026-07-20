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

/**
 * Notification relay API — forwards internal notifications to the loop-task pipeline.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('content-type', 'application/json; charset=utf-8')

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, message: 'Use POST to send a notification.' })
    return
  }

  // This endpoint writes with the service-role key. It has no public UI caller,
  // so require the worker token to prevent anonymous queue injection.
  const WORKER_TOKEN = process.env.ORCHESTRATOR_WORKER_TOKEN
  const authHeader = req.headers['authorization'] || req.headers['Authorization']
  const bearer = Array.isArray(authHeader) ? authHeader[0] : authHeader
  if (!WORKER_TOKEN || bearer !== `Bearer ${WORKER_TOKEN}`) {
    res.status(401).json({ ok: false, message: 'Unauthorized.' })
    return
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body

    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && body?.task) {
      await fetch(`${SUPABASE_URL}/rest/v1/loop_task_handoffs`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          task_id: `notify-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          task: body.task,
          kind: body.kind || 'dashboard',
          priority: body.priority || 'normal',
          destination: body.destination || 'auto',
          status: 'queued',
          delivery_message: null,
          process: JSON.stringify([
            { label: 'Received', state: 'done', detail: 'Notification queued.' },
            { label: 'Deliver', state: 'pending', detail: 'Waiting for worker/bot to process.' },
          ]),
          metadata: body.metadata ? JSON.stringify(body.metadata) : null,
        }),
      })
    }

    res.status(200).json({ ok: true, message: 'Notification queued.' })
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}
