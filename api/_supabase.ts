/** Shared Supabase REST helpers for serverless functions (service-role access). */

export const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
export const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''

export function isConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
}

export function serviceHeaders(prefer?: string): Record<string, string> {
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'content-type': 'application/json',
    ...(prefer ? { prefer } : {}),
  }
}

/** Fetch a Supabase REST path; throws on non-2xx. */
export async function sb<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL')
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    signal: AbortSignal.timeout(8_000),
    ...init,
    headers: { ...serviceHeaders((init as { prefer?: string }).prefer), ...(init.headers || {}) },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Supabase ${path}: HTTP ${res.status} ${text.slice(0, 200)}`)
  }
  if (res.status === 204) return null as T
  return (await res.json()) as T
}

export async function insert<T = unknown>(table: string, row: Record<string, unknown>): Promise<T> {
  return sb<T>(table, { method: 'POST', headers: serviceHeaders('return=representation'), body: JSON.stringify(row) })
}

export async function patch<T = unknown>(table: string, filter: string, row: Record<string, unknown>): Promise<T> {
  return sb<T>(`${table}?${filter}`, { method: 'PATCH', headers: serviceHeaders('return=representation'), body: JSON.stringify(row) })
}
