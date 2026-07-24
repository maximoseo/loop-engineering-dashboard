import { requestHeader, type AuthRequest, type AuthenticatedUser } from './_auth.js'
import { sb } from './_supabase.js'

export type WorkspaceRole = 'owner' | 'admin' | 'operator' | 'viewer'
export interface WorkspaceAccess { workspaceId: string; role: WorkspaceRole }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MUTATING_ROLES = new Set<WorkspaceRole>(['owner', 'admin', 'operator'])

function requestedWorkspace(req: AuthRequest): string | null {
  const value = requestHeader(req, 'x-workspace-id')?.trim()
  return value && UUID.test(value) ? value : null
}

/** Resolve the caller to an active workspace membership. Ambiguous callers must select a workspace. */
export async function workspaceForUser(
  req: AuthRequest,
  user: AuthenticatedUser,
  mutate = false,
): Promise<WorkspaceAccess | null> {
  const requested = requestedWorkspace(req)
  const filter = requested ? `&workspace_id=eq.${encodeURIComponent(requested)}` : ''
  const rows = await sb<Array<{ workspace_id: string; role: WorkspaceRole }>>(
    `loop_workspace_members?select=workspace_id,role&user_id=eq.${encodeURIComponent(user.id)}&status=eq.active${filter}&limit=2`,
    { signal: AbortSignal.timeout(5_000) },
  )
  if (rows.length !== 1) return null
  const access = { workspaceId: rows[0].workspace_id, role: rows[0].role }
  return mutate && !MUTATING_ROLES.has(access.role) ? null : access
}

/** Worker/cron calls are explicitly pinned to one configured workspace. */
export function workspaceForWorker(req: AuthRequest): string | null {
  const configured = process.env.LOOP_WORKSPACE_ID?.trim() || null
  const requested = requestedWorkspace(req)
  if (!configured || !UUID.test(configured)) return null
  if (requested && requested !== configured) return null
  return configured
}
