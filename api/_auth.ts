import { timingSafeEqual } from 'node:crypto'

export type AuthRequest = {
  headers: Record<string, string | string[] | undefined>
}

export interface AuthenticatedUser {
  id: string
  email?: string
}

export function requestHeader(req: AuthRequest, name: string): string | undefined {
  const expected = name.toLowerCase()
  const entry = Object.entries(req.headers).find(([key]) => key.toLowerCase() === expected)?.[1]
  return Array.isArray(entry) ? entry[0] : entry
}

export function bearerToken(req: AuthRequest): string | null {
  const authorization = requestHeader(req, 'authorization')
  const match = authorization?.match(/^Bearer\s+(\S+)$/i)
  return match?.[1] || null
}

export function emailAllowlist(value: string | undefined): string[] {
  return (value || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

export function allowlistedEmail(user: AuthenticatedUser, value: string | undefined): boolean {
  const allowlist = emailAllowlist(value)
  return allowlist.length > 0 && Boolean(user.email && allowlist.includes(user.email.toLowerCase()))
}

/** Verify a browser Supabase access token against the project's Auth API. */
export async function authenticateSupabaseUser(req: AuthRequest): Promise<AuthenticatedUser | null> {
  const token = bearerToken(req)
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!token || !supabaseUrl || !anonKey) return null

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5_000),
    })
    if (!response.ok) return null
    const user = await response.json() as { id?: unknown; email?: unknown }
    if (typeof user.id !== 'string' || !user.id) return null
    return {
      id: user.id,
      ...(typeof user.email === 'string' && user.email ? { email: user.email } : {}),
    }
  } catch {
    return null
  }
}

function safeTokenEqual(actual: string | null | undefined, expected: string): boolean {
  if (!actual) return false
  const left = Buffer.from(actual)
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

export function workerTokenAuthorized(req: AuthRequest, token: string | undefined): boolean {
  if (!token) return false
  return safeTokenEqual(bearerToken(req), token) || safeTokenEqual(requestHeader(req, 'x-worker-token'), token)
}
