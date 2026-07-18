import { useState, Component, type ReactNode } from 'react'
import { sanitizePath, sanitizeField } from '../lib/sanitize'
import type { ImprovementProposal } from '../types'
import { approveProposal, rejectProposal } from '../lib/proposalActions'

interface ProposalCardProps {
  proposal: ImprovementProposal
  onUpdate?: () => void
}

export function ProposalCard({ proposal, onUpdate }: ProposalCardProps) {
  const [loading, setLoading] = useState(false)
  const [reason, setReason] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const displayPath = sanitizePath(proposal.target || '')
  const cleanDescription = sanitizeField(proposal.description)

  const statusColors: Record<string, string> = {
    proposed: 'bg-yellow-500/20 text-yellow-400',
    testing: 'bg-blue-500/20 text-blue-400',
    pending_approval: 'bg-purple-500/20 text-purple-400',
    active: 'bg-green-500/20 text-green-400',
    rejected: 'bg-red-500/20 text-red-400',
    rolled_back: 'bg-gray-500/20 text-gray-400',
  }

  const canApprove = proposal.status === 'proposed' || proposal.status === 'pending_approval'

  const handleApprove = async () => {
    setLoading(true)
    setError('')
    try {
      await approveProposal(proposal.id)
      setDone(true)
      onUpdate?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Approval failed')
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    if (!reason.trim()) return
    setLoading(true)
    setError('')
    try {
      await rejectProposal(proposal.id, reason)
      setDone(true)
      onUpdate?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rejection failed')
    } finally {
      setLoading(false)
    }
  }

  if (done) return null

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-[var(--text-secondary)]">{proposal.id?.slice(0, 12)}</span>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${proposal.type === 'skill' ? 'bg-indigo-500/20 text-indigo-400' : proposal.type === 'memory' ? 'bg-teal-500/20 text-teal-400' : 'bg-orange-500/20 text-orange-400'}`}>
            {proposal.type}
          </span>
          <span className={`px-2 py-0.5 rounded text-xs ${statusColors[proposal.status] || 'bg-gray-500/20 text-gray-400'}`}>
            {proposal.status}
          </span>
        </div>
        <span className="text-xs text-[var(--text-secondary)]" title={displayPath.full}>
          {displayPath.display}
        </span>
      </div>

      {cleanDescription && (
        <p className="text-sm text-[var(--text)] leading-relaxed">{cleanDescription}</p>
      )}

      {/* Approve/Reject buttons */}
      {canApprove && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              onClick={handleApprove}
              disabled={loading}
              className="px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors"
            >
              {loading ? '...' : '✓ Approve'}
            </button>
            <button
              onClick={() => setShowReject(!showReject)}
              disabled={loading}
              className="px-4 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-sm rounded-lg font-medium disabled:opacity-50 transition-colors"
            >
              ✕ Reject
            </button>
          </div>

          {showReject && (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Rejection reason (required)..."
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="flex-1 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text)]"
                autoFocus
              />
              <button
                onClick={handleReject}
                disabled={loading || !reason.trim()}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg disabled:opacity-50"
              >
                Confirm
              </button>
            </div>
          )}
        </div>
      )}

      {error && <div className="text-xs text-red-400">{error}</div>}
    </div>
  )
}

export class SectionErrorBoundary extends Component<
  { children: ReactNode; name: string },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <div className="text-red-400 text-sm font-medium">Error in {this.props.name}</div>
          <div className="text-red-300/70 text-xs mt-1">{this.state.error.message}</div>
        </div>
      )
    }
    return this.props.children
  }
}
