/**
 * Simple in-memory rate limiter for Vercel serverless functions.
 * Uses a sliding window approach. Not suitable for multi-instance deploys
 * without Redis — for production scale, use Upstash/Vercel KV.
 */

const WINDOW_MS = 60_000 // 1 minute
const MAX_REQUESTS = 20 // per window

interface BucketEntry {
  count: number
  resetAt: number
}

const buckets = new Map<string, BucketEntry>()

// Prune stale entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of buckets) {
    if (now > entry.resetAt) buckets.delete(key)
  }
}, 300_000).unref()

export function rateLimit(identifier: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now()
  const existing = buckets.get(identifier)

  if (!existing || now > existing.resetAt) {
    buckets.set(identifier, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, remaining: MAX_REQUESTS - 1, resetIn: WINDOW_MS }
  }

  existing.count++
  if (existing.count > MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetIn: existing.resetAt - now }
  }

  return { allowed: true, remaining: MAX_REQUESTS - existing.count, resetIn: existing.resetAt - now }
}

export function getClientIdentifier(req: { headers: Record<string, string | string[] | undefined> }): string {
  const forwarded = req.headers['x-forwarded-for']
  const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]?.trim()
  return ip || 'unknown'
}
