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
  url ?? 'https://placeholder.supabase.co',
  key ?? 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
)

export const supabaseConfigured = Boolean(url && key)
