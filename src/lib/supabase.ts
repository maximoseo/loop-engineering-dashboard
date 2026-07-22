import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Shared Supabase browser client. Auth sessions persist to localStorage and
 * auto-refresh, so a page reload keeps the operator signed in. Data reads still
 * go through the anon REST layer in liveData.ts; this client owns auth + any
 * future authenticated writes.
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

/**
 * Current operator session token, or null when signed out. Data reads in
 * liveData.ts send this as the Authorization bearer so RLS sees an
 * authenticated role instead of the anon key.
 */
export async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}
