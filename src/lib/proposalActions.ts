/**
 * Proposal approval actions for the dashboard.
 * Requires authenticated user session from AuthContext.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

async function getSessionToken(): Promise<string | null> {
  // Read session from localStorage (set by Supabase auth)
  const stored = localStorage.getItem('supabase.auth.token')
  if (!stored) return null
  try {
    const parsed = JSON.parse(stored)
    return parsed?.currentSession?.access_token || null
  } catch {
    return null
  }
}

export async function approveProposal(
  proposalId: string,
  reason: string = 'Approved from dashboard',
): Promise<{ ok: boolean; message: string }> {
  const token = await getSessionToken()
  if (!token) throw new Error('Not authenticated')

  const response = await fetch('/api/proposal-approve', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ proposalId, action: 'approved', reason }),
  })

  return response.json()
}

export async function rejectProposal(
  proposalId: string,
  reason: string,
): Promise<{ ok: boolean; message: string }> {
  const token = await getSessionToken()
  if (!token) throw new Error('Not authenticated')

  if (!reason) throw new Error('Rejection requires a reason')

  const response = await fetch('/api/proposal-approve', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ proposalId, action: 'rejected', reason }),
  })

  return response.json()
}
