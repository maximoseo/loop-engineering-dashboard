import { allowlistedEmail, authenticateSupabaseUser, type AuthenticatedUser } from './_auth.js'
import { ProposalApproveSchema, validate, type ProposalApprove } from './schemas.js'

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
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

async function applyProposalDecision(
  proposalId: string,
  decision: 'approved' | 'rejected',
  reason: string,
  actor: AuthenticatedUser,
): Promise<'updated' | 'not_found' | 'not_pending' | 'failed'> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/apply_loop_proposal_decision`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY as string,
      authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      p_proposal_id: proposalId,
      p_decision: decision,
      p_reason: reason,
      p_actor_user_id: actor.id,
      p_actor_email: actor.email || null,
    }),
  })
  if (!response.ok) return 'failed'
  const result = await response.json()
  if (result === 'applied') return 'updated'
  if (result === 'not_found') return 'not_found'
  if (result === 'not_pending') return 'not_pending'
  return 'failed'
}

function asBody(body: unknown): ProposalApprove | null {
  let candidate = body
  if (typeof candidate === 'string') {
    try { candidate = JSON.parse(candidate) } catch { return null }
  }
  const result = validate(ProposalApproveSchema, candidate)
  return result.success ? result.data : null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('content-type', 'application/json; charset=utf-8')

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, message: 'Use POST to approve/reject a proposal.' })
    return
  }

  const session = await authenticateSupabaseUser(req)
  if (!session) {
    res.status(401).json({ ok: false, message: 'Invalid or expired session.' })
    return
  }

  if (!allowlistedEmail(session, process.env.LOOP_APPROVER_EMAILS)) {
    res.status(403).json({ ok: false, message: 'Proposal approval is not configured for this account.' })
    return
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    res.status(500).json({ ok: false, message: 'Server is not configured for approvals.' })
    return
  }

  const data = asBody(req.body)
  if (!data || !data.proposalId) {
    res.status(400).json({ ok: false, message: 'proposalId and action are required.' })
    return
  }

  const newStatus = data.action === 'approved' ? 'active' : 'rejected'

  try {
    const result = await applyProposalDecision(data.proposalId, data.action, data.reason ?? '', session)
    if (result === 'not_found') {
      res.status(404).json({ ok: false, message: 'Proposal not found.' })
      return
    }
    if (result === 'not_pending') {
      res.status(409).json({ ok: false, message: 'Proposal is no longer pending approval.' })
      return
    }
    if (result === 'failed') {
      res.status(500).json({ ok: false, message: 'The proposal decision could not be recorded.' })
      return
    }

    res.status(200).json({
      ok: true,
      proposalId: data.proposalId,
      action: data.action,
      status: newStatus,
      message: `Proposal ${data.proposalId} ${data.action}.`,
    })
  } catch (error) {
    console.error('Proposal approval failed', error)
    res.status(500).json({
      ok: false,
      message: 'The proposal approval could not be completed.',
    })
  }
}
