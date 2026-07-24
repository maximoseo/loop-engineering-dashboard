import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Shared Supabase browser client. Auth sessions use tab-scoped sessionStorage,
 * never localStorage; task briefs/results are only persisted in tenant-scoped
 * Supabase rows. REST/API reads
 * use this client's current access token rather than the anon key as bearer.
 */
export const supabase: SupabaseClient = createClient(
  url || 'https://placeholder.supabase.co',
  key || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      storage: typeof sessionStorage === 'undefined' ? undefined : sessionStorage,
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
  if (!token) return {}
  const workspaceId = await getActiveWorkspaceId()
  return {
    authorization: `Bearer ${token}`,
    ...(workspaceId ? { 'x-workspace-id': workspaceId } : {}),
  }
}

export async function getActiveWorkspaceId(): Promise<string | null> {
  const selected = typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem('loop-workspace-id')
  const { data, error } = await supabase
    .from('loop_workspace_members')
    .select('workspace_id')
    .eq('status', 'active')
    .limit(2)
  if (error || !data?.length) return null
  const ids = data.map((row) => String(row.workspace_id))
  if (selected && ids.includes(selected)) return selected
  if (ids.length !== 1) return null
  if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('loop-workspace-id', ids[0])
  return ids[0]
}
