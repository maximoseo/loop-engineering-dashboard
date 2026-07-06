import type { ImprovementProposal, ProposalStatus, ProposalType } from '../types.ts'

interface Props {
  improvements: ImprovementProposal[]
}

const statusConfig: Record<ProposalStatus, { color: string; icon: string; label: string }> = {
  proposed: { color: 'var(--text-muted)', icon: '📝', label: 'Proposed' },
  testing: { color: 'var(--warning)', icon: '🧪', label: 'Testing' },
  active: { color: 'var(--success)', icon: '✅', label: 'Active' },
  rejected: { color: 'var(--error)', icon: '❌', label: 'Rejected' },
  rolled_back: { color: 'var(--error)', icon: '↩️', label: 'Rolled Back' },
}

const typeConfig: Record<ProposalType, { color: string; label: string }> = {
  memory: { color: 'var(--info)', label: 'Memory' },
  skill: { color: 'var(--accent)', label: 'Skill' },
  prompt: { color: 'var(--warning)', label: 'Prompt' },
  config: { color: 'var(--text-muted)', label: 'Config' },
  mcp: { color: 'var(--success)', label: 'MCP' },
}

export function ImprovementFeed({ improvements }: Props) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">Recent Improvements</h2>
        <span className="text-xs text-[var(--text-dim)]">{improvements.length} total</span>
      </div>
      <div className="space-y-2">
        {improvements.map((imp) => {
          const sc = statusConfig[imp.status]
          const tc = typeConfig[imp.type]
          return (
            <div key={imp.id} className="flex items-start gap-3 p-3 rounded-lg bg-[var(--bg-primary)]/50 hover:bg-[var(--bg-primary)] transition-colors">
              <span className="text-lg mt-0.5">{sc.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: `${tc.color}20`, color: tc.color }}>
                    {tc.label}
                  </span>
                  <span className="text-sm font-medium truncate">{imp.target}</span>
                  <span className="text-xs" style={{ color: sc.color }}>{sc.label}</span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-1">{imp.description}</p>
                {imp.rolled_back_reason && (
                  <p className="text-xs text-[var(--error)] mt-1 italic">↳ {imp.rolled_back_reason}</p>
                )}
                <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-dim)]">
                  <span>{imp.timestamp}</span>
                  <span className="flex items-center gap-1">
                    Eval: <span style={{ color: imp.eval_score_after > imp.eval_score_before ? 'var(--success)' : 'var(--error)' }}>
                      {imp.eval_score_before} → {imp.eval_score_after}
                    </span>
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-xs ${imp.risk_level === 'high' ? 'bg-[var(--error)]/20 text-[var(--error)]' : imp.risk_level === 'medium' ? 'bg-[var(--warning)]/20 text-[var(--warning)]' : 'bg-[var(--success)]/20 text-[var(--success)]'}`}>
                    {imp.risk_level}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
