/**
 * Proposal approval API — authenticated route for dashboard-based approval.
 * Requires: Authorization header with Supabase session token.
 * POST /api/proposal-approve — approve or reject a proposal by ID.
 */

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

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface ApprovalRequest {
  proposalId: string
  action: 'approved' | 'rejected'
  reason: string
}

async function verifySession(token: string): Promise<{ userId: string } | null> {
  if (!SUPABASE_URL) return null
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: process.env.VITE_SUPABASE_ANON_KEY || '',
      authorization: `Bearer ${token}`,
    },
  })
  if (!response.ok) return null
  const user = await response.json() as { id: string }
  return { userId: user.id }
}

async function updateProposal(proposalId: string, status: string, reason: string) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/loop_proposals?proposal_id=eq.${encodeURIComponent(proposalId)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'content-type': 'application/json',
        prefer: 'return=representation',
      },
      body: JSON.stringify({
        status,
        eval_summary: { approved_by: 'dashboard', reason, timestamp: new Date().toISOString() },
        ...(status === 'active' ? { activated_at: new Date().toISOString() } : {}),
        ...(status === 'rejected' ? { rolled_back_at: new Date().toISOString() } : {}),
      }),
    }
  )
  return response.ok
}

async function insertActivation(proposalId: string, action: string, reason: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/loop_activations`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      proposal_id: proposalId,
      action,
      reason,
      created_at: new Date().toISOString(),
    }),
  })
}

function asBody(body: unknown): ApprovalRequest | null {
  if (typeof body === 'string') {
    try { return JSON.parse(body) as ApprovalRequest } catch { return null }
  }
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>
    return {
      proposalId: String(b.proposalId || ''),
      action: (b.action === 'approved' || b.action === 'rejected') ? b.action as 'approved' | 'rejected' : 'rejected',
      reason: String(b.reason || '').slice(0, 500),
    }
  }
  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('content-type', 'application/json; charset=utf-8')

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, message: 'Use POST to approve/reject a proposal.' })
    return
  }

  // Verify auth
  const authHeader = req.headers.authorization
  const token = Array.isArray(authHeader) ? authHeader[0] : authHeader?.replace('Bearer ', '')
  if (!token) {
    res.status(401).json({ ok: false, message: 'Authentication required. Provide a Supabase session token.' })
    return
  }

  const session = await verifySession(token)
  if (!session) {
    res.status(401).json({ ok: false, message: 'Invalid or expired session.' })
    return
  }

  const data = asBody(req.body)
  if (!data || !data.proposalId) {
    res.status(400).json({ ok: false, message: 'proposalId and action are required.' })
    return
  }

  const newStatus = data.action === 'approved' ? 'active' : 'rejected'

  try {
    const updated = await updateProposal(data.proposalId, newStatus, data.reason)
    if (!updated) {
      res.status(404).json({ ok: false, message: 'Proposal not found or update failed.' })
      return
    }

    await insertActivation(data.proposalId, data.action, data.reason)

    res.status(200).json({
      ok: true,
      proposalId: data.proposalId,
      action: data.action,
      status: newStatus,
      message: `Proposal ${data.proposalId} ${data.action}.`,
    })
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}
