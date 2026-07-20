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

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || ''
// Map the dashboard's model labels to OpenRouter model ids (default is a cheap,
// reliable model; unknown labels fall back to it).
const MODEL_MAP: Record<string, string> = { 'DeepSeek V4': 'deepseek/deepseek-chat' }
export function llmModel(name: string) { return MODEL_MAP[name] || 'openai/gpt-4o-mini' }

// Run a non-URL task through an LLM so it produces a real answer instead of
// sitting in needs_review. Effort controls the length budget.
// Per-task cost accumulator (Firecrawl credits + LLM tokens).
interface Cost { firecrawl_credits: number; llm_tokens: number }

async function llmChat(system: string, user: string, modelName: string, maxTokens: number, cost?: Cost): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${OPENROUTER_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: llmModel(modelName),
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
    signal: AbortSignal.timeout(25000), // never hang the worker on a slow model
  })
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${(await res.text()).slice(0, 140)}`)
  const j = await res.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: { total_tokens?: number } }
  if (cost && typeof j.usage?.total_tokens === 'number') cost.llm_tokens += j.usage.total_tokens
  const out = j.choices?.[0]?.message?.content?.trim()
  if (!out) throw new Error('LLM returned empty')
  return out
}

// Run a non-URL task through an LLM so it produces a real answer instead of
// sitting in needs_review. Effort controls the length budget.
async function llmAnswer(task: string, modelName: string, effort: string, cost?: Cost): Promise<string> {
  const max = effort === 'high' || effort === 'max' ? 1200 : effort === 'low' ? 350 : 700
  return llmChat('You are a Loop Engineering worker. Complete the user task concisely and concretely with actionable output. Plain text, short paragraphs or numbered points, no markdown headers.', task, modelName, max, cost)
}

// Each bot reviews the same page through a different lens.
const BOT_LENS: Record<string, string> = {
  'Security Guard': 'Focus on security and privacy: exposed data, mixed content, unsafe or excessive third-party scripts, missing security headers.',
  'QA Verifier': 'Focus on functional and UX quality: broken layout, accessibility, forms, navigation, and mobile behaviour.',
  'Frontend Builder': 'Focus on front-end performance and UX: bundle weight, render-blocking resources, layout shift, and polish.',
  'SEO Researcher': 'Focus on SEO: crawlability, metadata, headings, content depth, structured data, and Core Web Vitals.',
}
function botLens(bot: string) { return BOT_LENS[bot] || BOT_LENS['SEO Researcher'] }

// Turn the deterministic signals + rule findings into prioritised, explained
// fixes through the chosen bot's lens. Best-effort layer on top of the rules.
async function llmInterpret(url: string, deterministic: string, bot: string, modelName: string, effort: string, cost?: Cost): Promise<string> {
  const max = effort === 'high' || effort === 'max' ? 1100 : effort === 'low' ? 350 : 650
  const sys = `You are a ${bot || 'SEO Researcher'} reviewing a web page. ${botLens(bot)} Given the machine-collected signals and rule-based findings, return the top prioritised fixes as a numbered list — each with what to change, why it matters, and the expected impact. Be specific and concrete. Plain text, no markdown headers.`
  return llmChat(sys, `URL: ${url}\n\nSignals & rule-based findings:\n${deterministic}`, modelName, max, cost)
}

const CLAIMABLE = ['queued', 'delivered']

interface StoredTask {
  task_id: string
  task: string
  status: string
  priority?: string
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

export function firstUrl(task: StoredTask): string | null {
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

async function firecrawl(url: string, cost?: Cost): Promise<Scrape> {
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
  if (cost) cost.firecrawl_credits += typeof m.creditsUsed === 'number' ? (m.creditsUsed as number) : 1
  return {
    title: (m.title as string) || (m.ogTitle as string) || undefined,
    description: (m.description as string) || (m.ogDescription as string) || undefined,
    ogImage: (m.ogImage as string) || undefined,
    html: json.data.rawHtml || json.data.html || '',
    links: json.data.links || [],
  }
}

// Deterministic SEO/UX heuristics over the fetched HTML — no LLM required.
export function auditSite(url: string, s: Scrape, effort: string): string {
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
  const hasLang = /<html[^>]*\slang=/i.test(html)
  const h2 = count(/<h2[\b >]/gi)
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
  if (!hasLang) med.push('[MED] No lang attribute on <html> — add lang="…" for accessibility and correct language targeting.')
  else good.push('lang set')
  if (h2 === 0) med.push('[MED] No H2 subheadings — add H2s to structure the content for readers and search engines.')
  else good.push(`${h2} H2 subheadings`)

  // Effort controls audit depth: low = top 3, medium = 5, high/max = up to 8.
  const topN = effort === 'high' || effort === 'max' ? 8 : effort === 'low' ? 3 : 5
  const fixes = [...high, ...med]
  const top = fixes.slice(0, topN)
  const lines: string[] = []
  lines.push(`SEO/UX audit — ${url}`)
  lines.push(`Signals: title ${titleLen}c · desc ${descLen}c · H1×${h1} · H2×${h2} · ${imgs.length} imgs (${noAlt} no-alt) · ${scripts} scripts · ~${kb}KB · ${s.links.length} links · viewport ${hasViewport ? '✓' : '✗'} · canonical ${hasCanonical ? '✓' : '✗'} · JSON-LD ${hasLdJson ? '✓' : '✗'} · lang ${hasLang ? '✓' : '✗'}.`)
  lines.push('')
  lines.push(`Top ${top.length} highest-impact fixes:`)
  top.forEach((f, i) => lines.push(`${i + 1}. ${f}`))
  if (good.length) { lines.push(''); lines.push(`Already solid: ${good.join(', ')}.`) }
  if (fixes.length > top.length) { lines.push(''); lines.push(`(+${fixes.length - top.length} more lower-priority items.)`) }
  return lines.join('\n')
}

async function claimOldest(): Promise<StoredTask | null> {
  const res = await sb(`loop_task_handoffs?select=*&status=in.(${CLAIMABLE.join(',')})&order=created_at.asc&limit=15`)
  const rows = (await res.json()) as StoredTask[]
  // Priority ordering: urgent → high → normal, keeping FIFO within a priority
  // (Array.sort is stable, so the created_at.asc order is preserved per bucket).
  const rank: Record<string, number> = { urgent: 0, high: 1, normal: 2 }
  rows.sort((a, b) => (rank[a.priority ?? 'normal'] ?? 3) - (rank[b.priority ?? 'normal'] ?? 3))
  for (const row of rows) {
    // Atomic claim: only one worker wins the guarded PATCH.
    const claimed = await patchTask(row.task_id, row.status, { status: 'accepted', claimed_at: new Date().toISOString() })
    if (claimed) { await event(row.task_id, 'accepted', 'Worker claimed the task from the queue.', { worker: 'vercel-cron' }); return claimed }
  }
  return null
}

function metaStr(task: StoredTask, key: string): string {
  const v = task.metadata ? (task.metadata as Record<string, unknown>)[key] : undefined
  return typeof v === 'string' ? v : ''
}

// Reaper: a task claimed but never finished (worker crashed / timed out mid-run)
// stays stuck in accepted/running forever. Re-queue anything claimed > 3 min ago.
async function requeueStale(): Promise<{ requeued: number; deadLettered: number }> {
  const cutoff = new Date(Date.now() - 3 * 60 * 1000).toISOString()
  const res = await sb(`loop_task_handoffs?select=*&status=in.(accepted,running)&claimed_at=lt.${encodeURIComponent(cutoff)}&limit=20`)
  const rows = (await res.json()) as StoredTask[]
  let requeued = 0, deadLettered = 0
  for (const r of rows) {
    const meta = (r.metadata as Record<string, unknown>) || {}
    const attempts = (typeof meta.requeues === 'number' ? meta.requeues : 0) + 1
    if (attempts > 3) {
      // Dead-letter: stop retrying and surface for a human instead of looping.
      const ok = await patchTask(r.task_id, r.status, { status: 'needs_review', error: 'Repeatedly stalled — dead-lettered after 3 retries.', metadata: { ...meta, requeues: attempts } })
      if (ok) { deadLettered++; await event(r.task_id, 'needs_review', 'Task stalled 3+ times and was moved to needs-review (dead-letter).', {}); await telegram(`⛔ Dead-letter — task stalled repeatedly:\n${shorten(r.task)}`) }
    } else {
      const ok = await patchTask(r.task_id, r.status, { status: 'delivered', metadata: { ...meta, requeues: attempts } })
      if (ok) { requeued++; await event(r.task_id, 'requeued', `Task was stuck in progress and has been re-queued (attempt ${attempts}).`, {}) }
    }
  }
  return { requeued, deadLettered }
}

// Process a single already-claimed task end to end.
async function processOne(task: StoredTask): Promise<{ taskId: string; status: string }> {
  const ranAs = [metaStr(task, 'bot'), metaStr(task, 'model'), metaStr(task, 'effort')].filter(Boolean).join(' · ')
  const effort = metaStr(task, 'effort')
  const cost: Cost = { firecrawl_credits: 0, llm_tokens: 0 }
  const withCost = () => ({ ...(task.metadata || {}), cost })
  const url = firstUrl(task)
  if (!url) {
    // No URL to audit — run the task through an LLM so it still gets a real answer.
    if (!OPENROUTER_API_KEY) {
      await patchTask(task.task_id, 'accepted', { status: 'needs_review' })
      await event(task.task_id, 'needs_review', 'No URL found and no LLM configured — needs a human or specialised agent.', {})
      await telegram(`⚠️ Needs review — no URL in the task:\n${shorten(task.task)}`)
      return { taskId: task.task_id, status: 'needs_review' }
    }
    await patchTask(task.task_id, 'accepted', { status: 'running' })
    await event(task.task_id, 'running', 'No URL — running the task through an LLM…', {})
    await telegram(`🔄 Working on it…${ranAs ? ` (${ranAs})` : ''}\n${shorten(task.task)}`)
    try {
      let answer = await llmAnswer(task.task, metaStr(task, 'model'), effort, cost)
      if (ranAs) answer += `\n\nRan as: ${ranAs}.`
      await event(task.task_id, 'result_ready', 'LLM response written to result_summary.', {})
      await patchTask(task.task_id, 'running', { status: 'done', result_summary: answer, completed_at: new Date().toISOString(), metadata: withCost() })
      await event(task.task_id, 'done', 'Task completed by the worker (LLM).', {})
      await telegram(`✅ Done\n${shorten(task.task)}\n\n${answer}\n\nSee it on the dashboard → Task queue.`)
      return { taskId: task.task_id, status: 'done' }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await patchTask(task.task_id, 'running', { status: 'failed', error: message })
      await event(task.task_id, 'failed', `LLM run failed: ${message}`, {})
      await telegram(`❌ Failed\n${shorten(task.task)}\n${message}`)
      return { taskId: task.task_id, status: 'failed' }
    }
  }

  await patchTask(task.task_id, 'accepted', { status: 'running' })
  await event(task.task_id, 'running', `Fetching ${url} and analysing SEO/UX signals…`, {})
  await telegram(`🔄 Working on it…${ranAs ? ` (${ranAs})` : ''}\n${shorten(task.task)}\n${url}`)

  if (!FIRECRAWL_API_KEY) {
    await patchTask(task.task_id, 'running', { status: 'failed', error: 'FIRECRAWL_API_KEY not set' })
    await event(task.task_id, 'failed', 'Scraper not configured (FIRECRAWL_API_KEY missing).', {})
    return { taskId: task.task_id, status: 'failed' }
  }

  let summary: string
  try {
    const scrape = await firecrawl(url, cost)
    summary = auditSite(url, scrape, effort)
    // Layer an LLM interpretation through the chosen bot's lens on top of the
    // deterministic findings (best-effort — deterministic result stays if it fails).
    if (OPENROUTER_API_KEY) {
      try {
        const bot = metaStr(task, 'bot')
        const interpreted = await llmInterpret(url, summary, bot, metaStr(task, 'model'), effort, cost)
        summary += `\n\n— ${bot || 'Reviewer'} analysis —\n${interpreted}`
      } catch { /* keep deterministic-only */ }
    }
    if (ranAs) summary += `\n\nRan as: ${ranAs}.`
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await patchTask(task.task_id, 'running', { status: 'failed', error: message })
    await event(task.task_id, 'failed', `Could not fetch/analyse the page: ${message}`, {})
    await telegram(`❌ Failed — ${url}\n${shorten(task.task)}\n${message}`)
    return { taskId: task.task_id, status: 'failed' }
  }

  await event(task.task_id, 'result_ready', 'Audit complete — result written to result_summary.', {})
  await patchTask(task.task_id, 'running', { status: 'done', result_summary: summary, completed_at: new Date().toISOString(), metadata: withCost() })
  await event(task.task_id, 'done', 'Task completed by the worker.', {})
  await telegram(`✅ Done — ${url}\n\n${summary}\n\nSee the full process on the dashboard → Task queue.`)
  return { taskId: task.task_id, status: 'done' }
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
    const { requeued, deadLettered } = await requeueStale()
    // Batch: drain up to 3 tasks per invocation so a backlog clears faster than
    // one-per-minute. Each is claimed atomically and processed end to end.
    const BATCH = 3
    const processed: Array<{ taskId: string; status: string }> = []
    for (let i = 0; i < BATCH; i++) {
      const task = await claimOldest()
      if (!task) break
      processed.push(await processOne(task))
    }
    res.status(200).json({ ok: true, requeued, deadLettered, count: processed.length, processed })
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : String(error) })
  }
}
