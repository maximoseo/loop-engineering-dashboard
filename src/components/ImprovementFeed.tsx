import { useMemo, useState } from 'react'
import type { ImprovementProposal, ProposalStatus, ProposalType } from '../types.ts'
import type { JSX } from 'react'
import { filterImprovements, proposalApprovalCommand, type RiskFilter } from '../lib/operatorFilters.ts'

interface Props {
  improvements: ImprovementProposal[]
}

const statusConfig: Record<ProposalStatus, { color: string; label: string }> = {
  proposed: { color: '#71717a', label: 'Proposed' },
  testing: { color: '#fbbf24', label: 'Testing' },
  pending_approval: { color: '#60a5fa', label: 'Awaiting Approval' },
  active: { color: '#22d3ee', label: 'Active' },
  rejected: { color: '#f87171', label: 'Rejected' },
  rolled_back: { color: '#f87171', label: 'Rolled Back' },
}

const typeConfig: Record<ProposalType, { color: string; label: string }> = {
  memory: { color: '#60a5fa', label: 'Memory' },
  skill: { color: '#a78bfa', label: 'Skill' },
  prompt: { color: '#fbbf24', label: 'Prompt' },
  config: { color: '#71717a', label: 'Config' },
  mcp: { color: '#22d3ee', label: 'MCP' },
}

const statuses = ['all', 'proposed', 'testing', 'pending_approval', 'active', 'rejected', 'rolled_back'] as const
const risks = ['all', 'low', 'medium', 'high'] as const
const types = ['all', 'memory', 'skill', 'prompt', 'config', 'mcp'] as const

function StatusIcon({ status }: { status: ProposalStatus }) {
  const icons: Record<ProposalStatus, JSX.Element> = {
    proposed: <><path d="M12 20h9M16.5 3.5a2.12 2.12 0 113 3L7 19l-4 1 1-4L16.5 3.5z" /></>,
    testing: <><path d="M9 2v6L4 14v8h16v-8l-5-6V2" /><line x1="9" y1="2" x2="15" y2="2" /></>,
    pending_approval: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></>,
    active: <><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" /></>,
    rejected: <><circle cx="12" cy="12" r="9" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></>,
    rolled_back: <><path d="M3 7v6h6" /><path d="M21 17a9 9 0 00-15-6.7L3 13" /></>,
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {icons[status]}
    </svg>
  )
}

const selectClass = 'rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2 py-1.5 text-xs text-[var(--text-secondary)] outline-none'

export function ImprovementFeed({ improvements }: Props) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<(typeof statuses)[number]>('all')
  const [risk, setRisk] = useState<RiskFilter>('all')
  const [type, setType] = useState<(typeof types)[number]>('all')
  const [selected, setSelected] = useState<ImprovementProposal | null>(null)
  const filtered = useMemo(
    () => filterImprovements(improvements, { query, status, risk, type }),
    [improvements, query, risk, status, type],
  )
  const selectedCommand = selected ? proposalApprovalCommand(selected.id) : ''

  const copyApproval = async () => {
    if (!selectedCommand) return
    await navigator.clipboard?.writeText(selectedCommand)
  }

  return (
    <div id="improvements" className="rounded-2xl glass gradient-border p-5 md:p-6 animate-fade-in delay-3">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div>
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Recent Improvements</h3>
          <p className="mt-1 text-[11px] text-[var(--text-dim)]">Filter, inspect, and copy safe CLI approval handoffs — no public mutation endpoint.</p>
        </div>
        <span className="text-xs text-[var(--text-dim)] font-mono">{filtered.length}/{improvements.length} shown</span>
      </div>

      <div className="mb-4 grid grid-cols-1 sm:grid-cols-4 gap-2">
        <input
          className="sm:col-span-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text)] outline-none placeholder:text-[var(--text-dim)]"
          placeholder="Search proposals..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select className={selectClass} value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
          {statuses.map((item) => <option key={item} value={item}>status: {item}</option>)}
        </select>
        <select className={selectClass} value={risk} onChange={(event) => setRisk(event.target.value as RiskFilter)}>
          {risks.map((item) => <option key={item} value={item}>risk: {item}</option>)}
        </select>
        <select className={selectClass} value={type} onChange={(event) => setType(event.target.value as typeof type)}>
          {types.map((item) => <option key={item} value={item}>type: {item}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((imp) => {
          const sc = statusConfig[imp.status]
          const tc = typeConfig[imp.type]
          const targetName = imp.target.split(/[\\/]/).pop()?.replace(/SKILL\.md/i, '').replace(/-/g, ' ').trim() || imp.target
          const evalDelta = imp.eval_score_after - imp.eval_score_before
          return (
            <button
              key={imp.id}
              className="group relative overflow-hidden rounded-xl glass glass-hover p-4 transition-all duration-300 text-left focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              onClick={() => setSelected(imp)}
            >
              <div className="absolute top-0 left-0 w-1 h-full" style={{ background: sc.color, opacity: 0.6 }} />

              <div className="flex items-center gap-2 mb-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-lg shrink-0" style={{ background: `${tc.color}15`, color: tc.color }}>
                  <StatusIcon status={imp.status} />
                </span>
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider" style={{ background: `${tc.color}15`, color: tc.color }}>
                  {tc.label}
                </span>
                <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: `${sc.color}15`, color: sc.color }}>
                  {sc.label}
                </span>
              </div>

              <h4 className="text-sm font-semibold text-[var(--text)] mb-1.5 capitalize">{targetName}</h4>
              <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-3">{imp.description}</p>

              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-[var(--text-dim)]">{imp.timestamp}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--text-muted)]">{imp.eval_score_before} → {imp.eval_score_after}</span>
                  {evalDelta !== 0 && (
                    <span style={{ color: evalDelta > 0 ? '#22d3ee' : '#f87171' }}>{evalDelta > 0 ? '↑' : '↓'}{Math.abs(evalDelta)}</span>
                  )}
                </div>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <span className="text-[9px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider" style={{ background: imp.risk_level === 'high' ? 'rgba(248,113,113,0.15)' : imp.risk_level === 'medium' ? 'rgba(251,191,36,0.15)' : 'rgba(34,211,238,0.15)', color: imp.risk_level === 'high' ? '#f87171' : imp.risk_level === 'medium' ? '#fbbf24' : '#22d3ee' }}>
                  {imp.risk_level} risk
                </span>
                {imp.rolled_back_reason && <span className="text-[10px] text-[var(--error)] italic truncate" title={imp.rolled_back_reason}>↳ {imp.rolled_back_reason}</span>}
              </div>
            </button>
          )
        })}
      </div>

      {selected && (
        <div className="mt-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)]/60 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Proposal detail</p>
              <h4 className="mt-1 text-base font-semibold text-[var(--text)] break-all">{selected.target}</h4>
            </div>
            <button className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]" onClick={() => setSelected(null)}>Close</button>
          </div>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">{selected.description || 'No rationale provided.'}</p>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
            <span className="rounded-lg bg-[var(--bg-base)]/60 p-2">ID<br /><strong>{selected.id}</strong></span>
            <span className="rounded-lg bg-[var(--bg-base)]/60 p-2">Status<br /><strong>{selected.status}</strong></span>
            <span className="rounded-lg bg-[var(--bg-base)]/60 p-2">Risk<br /><strong>{selected.risk_level}</strong></span>
            <span className="rounded-lg bg-[var(--bg-base)]/60 p-2">Before<br /><strong>{selected.eval_score_before}</strong></span>
            <span className="rounded-lg bg-[var(--bg-base)]/60 p-2">After<br /><strong>{selected.eval_score_after}</strong></span>
          </div>
          <div className="mt-3 rounded-xl border border-[rgba(96,165,250,0.25)] bg-[rgba(96,165,250,0.06)] p-3">
            <p className="text-[10px] uppercase tracking-wider text-[#60a5fa]">Safe action handoff</p>
            <code className="mt-2 block overflow-x-auto rounded-lg bg-black/30 p-2 text-xs text-[var(--text-secondary)]">{selectedCommand}</code>
            <button className="mt-2 rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--accent-bright)] hover:border-[var(--border-glow)]" onClick={copyApproval}>
              Copy approval command
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
