import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Shared Supabase browser client. Auth sessions persist to localStorage and
 * auto-refresh, so a page reload keeps the operator signed in. REST/API reads
 * use this client's current access token rather than the anon key as bearer.
 */
export const supabase: SupabaseClient = createClient(
  url || 'https://placeholder.supabase.co',
  key || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
)

export const supabaseConfigured = Boolean(url && key)

export async function getAccessToken(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getSession()
    return error ? null : (data.session?.access_token ?? null)
  } catch {
    return null
  }
}

export async function supabaseAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken()
  return token ? { authorization: `Bearer ${token}` } : {}
}
