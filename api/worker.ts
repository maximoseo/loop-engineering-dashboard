// Minimal request/response shapes (mirrors api/loop-task.ts — @vercel/node is
// provided by the Vercel runtime at deploy time, not installed locally, so we
// avoid importing it to keep the local typecheck green).
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

// Loop task worker.
// Claims one active task from the queue, runs a real SEO/UX audit on any URL it
// carries (via Firecrawl), and writes accepted -> running -> done + result_summary
// back to Supabase so the dashboard timeline advances on its own. Triggered by a
// Vercel Cron (every minute) or a manual authenticated call.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY || ''
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || ''

// Fire a Telegram message to the configured chat. Best-effort: never throws.
async function telegram(text: string) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: text.slice(0, 3900), disable_web_page_preview: true }),
    })
  } catch { /* best effort */ }
}

function shorten(s: string, n = 140) { return s.length > n ? `${s.slice(0, n)}…` : s }

const CLAIMABLE = ['queued', 'delivered']

interface StoredTask {
  task_id: string
  task: string
  status: string
  metadata?: Record<string, unknown> | null
}

function headers(prefer?: string): Record<string, string> {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'content-type': 'application/json',
    ...(prefer ? { prefer } : {}),
  }
}

async function sb(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...headers((init as { prefer?: string }).prefer), ...(init.headers || {}) } })
  if (!res.ok) throw new Error(`Supabase ${path}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`)
  return res
}

async function event(task_id: string, event_type: string, message: string, metadata: Record<string, unknown> = {}) {
  await fetch(`${SUPABASE_URL}/rest/v1/loop_task_events`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ task_id, event_type, message, metadata }),
  })
}

async function patchTask(task_id: string, guardStatus: string, patch: Record<string, unknown>): Promise<StoredTask | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/loop_task_handoffs?task_id=eq.${encodeURIComponent(task_id)}&status=eq.${guardStatus}`, {
    method: 'PATCH',
    headers: headers('return=representation'),
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  })
  if (!res.ok) throw new Error(`patch ${task_id}: HTTP ${res.status}`)
  const rows = (await res.json()) as StoredTask[]
  return rows[0] || null
}

function firstUrl(task: StoredTask): string | null {
  const meta = task.metadata || {}
  const ctx = typeof meta.contextUrl === 'string' ? meta.contextUrl.trim() : ''
  if (/^https?:\/\//i.test(ctx)) return ctx
  const match = task.task.match(/https?:\/\/[^\s"'<>)]+/i)
  return match ? match[0] : null
}

interface Scrape {
  title?: string
  description?: string
  ogImage?: string
  html: string
  links: string[]
}

async function firecrawl(url: string): Promise<Scrape> {
  const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: { authorization: `Bearer ${FIRECRAWL_API_KEY}`, 'content-type': 'application/json' },
    // rawHtml = the true DOM (keeps <head> meta + scripts). The plain 'html'
    // format is readability-cleaned and strips them, which made viewport /
    // canonical / JSON-LD / script-count read as false negatives.
    body: JSON.stringify({ url, formats: ['rawHtml', 'links'], onlyMainContent: false, waitFor: 2500, timeout: 45000 }),
  })
  if (!res.ok) throw new Error(`Firecrawl HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`)
  const json = await res.json() as { success?: boolean; data?: { rawHtml?: string; html?: string; links?: string[]; metadata?: Record<string, unknown> }; error?: string }
  if (!json.success || !json.data) throw new Error(`Firecrawl: ${json.error || 'no data'}`)
  const m = json.data.metadata || {}
  return {
    title: (m.title as string) || (m.ogTitle as string) || undefined,
    description: (m.description as string) || (m.ogDescription as string) || undefined,
    ogImage: (m.ogImage as string) || undefined,
    html: json.data.rawHtml || json.data.html || '',
    links: json.data.links || [],
  }
}

// Deterministic SEO/UX heuristics over the fetched HTML — no LLM required.
function auditSite(url: string, s: Scrape): string {
  const html = s.html
  const lower = html.toLowerCase()
  const count = (re: RegExp) => (html.match(re) || []).length
  const h1 = count(/<h1[\b >]/gi)
  const imgs = html.match(/<img[^>]*>/gi) || []
  const noAlt = imgs.filter((i) => !/\balt\s*=/i.test(i)).length
  const scripts = count(/<script[\b >]/gi)
  const hasViewport = /name=["']viewport["']/i.test(html)
  const hasCanonical = /rel=["']canonical["']/i.test(html)
  const hasLdJson = lower.includes('application/ld+json')
  const kb = Math.round(html.length / 1024)
  const titleLen = (s.title || '').length
  const descLen = (s.description || '').length
  const ogIsLogo = !!s.ogImage && /logo|icon/i.test(s.ogImage)

  const high: string[] = []
  const med: string[] = []
  const good: string[] = []

  if (scripts >= 40 || kb >= 300) high.push(`[HIGH] Cut JS / page weight — ${scripts} <script> tags, ~${kb}KB HTML. Heavy for mobile; likely slow LCP and high blocking time. Defer/async non-critical JS, remove unused plugins, split & lazy-load.`)
  if (!s.title) high.push('[HIGH] Missing <title> tag — add a unique, keyword-led title (~30–60 chars).')
  else if (titleLen > 62 || titleLen < 20) high.push(`[HIGH] Title length is ${titleLen} chars — ${titleLen > 62 ? 'risks SERP truncation, tighten to ~55–60' : 'too short, make it more descriptive'}.`)
  else good.push('title present and reasonable length')

  if (!s.description) high.push('[HIGH] Missing meta description — add a compelling 120–160 char summary to lift CTR.')
  else if (descLen > 170 || descLen < 80) med.push(`[MED] Meta description is ${descLen} chars — aim for 120–160.`)
  else good.push('meta description present')

  if (h1 === 0) high.push('[HIGH] No <h1> on the page — add a single clear H1.')
  else if (h1 > 1) med.push(`[MED] ${h1} H1 tags — collapse to a single H1 for a clear topic signal.`)
  else good.push('single H1')

  if (ogIsLogo) med.push('[MED] og:image is a logo/icon — social shares show a tiny logo; set a 1200×630 hero image to raise share CTR.')
  else if (!s.ogImage) med.push('[MED] No og:image — set a 1200×630 share image for better social/WhatsApp previews.')
  else good.push('og:image set')

  if (noAlt > 0) med.push(`[MED] ${noAlt}/${imgs.length} images missing alt text — add descriptive alt for accessibility + image SEO.`)
  else if (imgs.length) good.push(`all ${imgs.length} images have alt text`)

  if (!hasViewport) high.push('[HIGH] No responsive viewport meta — add <meta name="viewport"> for mobile.')
  else good.push('viewport set')
  if (!hasCanonical) med.push('[MED] No canonical link — add rel="canonical" to avoid duplicate-URL dilution.')
  else good.push('canonical set')
  if (!hasLdJson) med.push('[MED] No structured data (JSON-LD) — add schema.org markup for rich results.')
  else good.push('JSON-LD present')

  const fixes = [...high, ...med]
  const top5 = fixes.slice(0, 5)
  const lines: string[] = []
  lines.push(`SEO/UX audit — ${url}`)
  lines.push(`Signals: title ${titleLen}c · desc ${descLen}c · H1×${h1} · ${imgs.length} imgs (${noAlt} no-alt) · ${scripts} scripts · ~${kb}KB · ${s.links.length} links · viewport ${hasViewport ? '✓' : '✗'} · canonical ${hasCanonical ? '✓' : '✗'} · JSON-LD ${hasLdJson ? '✓' : '✗'}.`)
  lines.push('')
  lines.push(`Top ${top5.length} highest-impact fixes:`)
  top5.forEach((f, i) => lines.push(`${i + 1}. ${f}`))
  if (good.length) { lines.push(''); lines.push(`Already solid: ${good.join(', ')}.`) }
  if (fixes.length > 5) { lines.push(''); lines.push(`(+${fixes.length - 5} more lower-priority items.)`) }
  return lines.join('\n')
}

async function claimOldest(): Promise<StoredTask | null> {
  const res = await sb(`loop_task_handoffs?select=*&status=in.(${CLAIMABLE.join(',')})&order=created_at.asc&limit=5`)
  const rows = (await res.json()) as StoredTask[]
  for (const row of rows) {
    // Atomic claim: only one worker wins the guarded PATCH.
    const claimed = await patchTask(row.task_id, row.status, { status: 'accepted', claimed_at: new Date().toISOString() })
    if (claimed) { await event(row.task_id, 'accepted', 'Worker claimed the task from the queue.', { worker: 'vercel-cron' }); return claimed }
  }
  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('content-type', 'application/json; charset=utf-8')

  const cronOk = process.env.CRON_SECRET && req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`
  const secret = (req.query?.secret as string) || (req.headers['x-worker-secret'] as string) || ''
  const manualOk = process.env.WORKER_SECRET && secret === process.env.WORKER_SECRET
  if (!cronOk && !manualOk) {
    res.status(401).json({ ok: false, message: 'Unauthorized worker call.' })
    return
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    res.status(500).json({ ok: false, message: 'Supabase env missing.' })
    return
  }

  try {
    const task = await claimOldest()
    if (!task) { res.status(200).json({ ok: true, processed: null, message: 'No claimable tasks.' }); return }

    const url = firstUrl(task)
    if (!url) {
      await patchTask(task.task_id, 'accepted', { status: 'needs_review' })
      await event(task.task_id, 'needs_review', 'No URL found in the task — needs a human or a specialised agent to run this.', {})
      await telegram(`⚠️ Needs review — no URL in the task:\n${shorten(task.task)}`)
      res.status(200).json({ ok: true, processed: task.task_id, status: 'needs_review', reason: 'no_url' })
      return
    }

    await patchTask(task.task_id, 'accepted', { status: 'running' })
    await event(task.task_id, 'running', `Fetching ${url} and analysing SEO/UX signals…`, {})
    await telegram(`🔄 Working on it…\n${shorten(task.task)}\n${url}`)

    if (!FIRECRAWL_API_KEY) {
      await patchTask(task.task_id, 'running', { status: 'failed', error: 'FIRECRAWL_API_KEY not set' })
      await event(task.task_id, 'failed', 'Scraper not configured (FIRECRAWL_API_KEY missing).', {})
      res.status(200).json({ ok: false, processed: task.task_id, status: 'failed', reason: 'no_firecrawl_key' })
      return
    }

    let summary: string
    try {
      const scrape = await firecrawl(url)
      summary = auditSite(url, scrape)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await patchTask(task.task_id, 'running', { status: 'failed', error: message })
      await event(task.task_id, 'failed', `Could not fetch/analyse the page: ${message}`, {})
      await telegram(`❌ Failed — ${url}\n${shorten(task.task)}\n${message}`)
      res.status(200).json({ ok: false, processed: task.task_id, status: 'failed', error: message })
      return
    }

    await event(task.task_id, 'result_ready', 'Audit complete — result written to result_summary.', {})
    await patchTask(task.task_id, 'running', { status: 'done', result_summary: summary, completed_at: new Date().toISOString() })
    await event(task.task_id, 'done', 'Task completed by the worker.', {})
    await telegram(`✅ Done — ${url}\n\n${summary}\n\nSee the full process on the dashboard → Task queue.`)
    res.status(200).json({ ok: true, processed: task.task_id, status: 'done', url })
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : String(error) })
  }
}
