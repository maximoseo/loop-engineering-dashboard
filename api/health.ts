/**
 * Health / readiness endpoint.
 *
 * GET /api/health → { status, version, sha, uptime, checks }
 *
 * Two levels:
 *   - Liveness: always 200 if the function is running.
 *   - Readiness: tests Supabase connectivity and env presence.
 */
type VercelRequest = { method?: string; query?: Record<string, string | string[] | undefined> }
type VercelResponse = {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
  setHeader: (name: string, value: string) => void
}

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const VERSION = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? 'local'
const BOOT = Date.now()

interface Check {
  name: string
  ok: boolean
  latencyMs?: number
  detail?: string
}

async function checkSupabase(): Promise<Check> {
  if (!SUPABASE_URL || !SERVICE_KEY) return { name: 'supabase', ok: false, detail: 'missing env' }
  const t0 = Date.now()
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/loop_state?select=phase&limit=1`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      signal: AbortSignal.timeout(5_000),
    })
    return { name: 'supabase', ok: r.ok, latencyMs: Date.now() - t0, detail: r.ok ? undefined : `HTTP ${r.status}` }
  } catch (e) {
    return { name: 'supabase', ok: false, latencyMs: Date.now() - t0, detail: String(e) }
  }
}

function checkEnv(): Check {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
  const missing = required.filter((k) => !process.env[k])
  return { name: 'env', ok: missing.length === 0, detail: missing.length ? `missing: ${missing.join(', ')}` : undefined }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method && req.method !== 'GET') {
    res.status(405).json({ error: 'Use GET' })
    return
  }

  res.setHeader('cache-control', 'no-store')

  const depth = req.query?.depth === 'full' ? 'full' : 'liveness'

  if (depth === 'liveness') {
    res.status(200).json({ status: 'ok', version: VERSION, uptime: Math.floor((Date.now() - BOOT) / 1000) })
    return
  }

  const checks = await Promise.all([checkSupabase(), checkEnv()])
  const allOk = checks.every((c) => c.ok)

  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'healthy' : 'degraded',
    version: VERSION,
    uptime: Math.floor((Date.now() - BOOT) / 1000),
    checks,
  })
}
