import { useMemo, useState } from 'react'
import type { Iteration } from '../types.ts'
import { filterIterations } from '../lib/operatorFilters.ts'

interface Props {
  iterations: Iteration[]
}

const minScoreOptions = [0, 70, 85, 95] as const

export function IterationTimeline({ iterations }: Props) {
  const [query, setQuery] = useState('')
  const [minScore, setMinScore] = useState<(typeof minScoreOptions)[number]>(0)
  const [selected, setSelected] = useState<Iteration | null>(null)
  const filtered = useMemo(() => filterIterations(iterations, { query, minScore }), [iterations, minScore, query])

  return (
    <div id="iterations" className="rounded-2xl glass gradient-border p-5 md:p-6 animate-fade-in delay-4">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div>
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Iteration History</h3>
          <p className="mt-1 text-[11px] text-[var(--text-dim)]">Search recent tasks, score thresholds, and inspect score/tool/token details.</p>
        </div>
        <span className="text-xs text-[var(--text-dim)] font-mono">{filtered.length}/{iterations.length} recent</span>
      </div>

      <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input
          className="sm:col-span-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text)] outline-none placeholder:text-[var(--text-dim)]"
          placeholder="Search iterations by task or id..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2 py-1.5 text-xs text-[var(--text-secondary)] outline-none"
          value={minScore}
          onChange={(event) => setMinScore(Number(event.target.value) as typeof minScore)}
        >
          {minScoreOptions.map((score) => <option key={score} value={score}>min score: {score}</option>)}
        </select>
      </div>

      {/* Vertical rail timeline */}
      <div className="relative">
        <div className="absolute left-3 md:left-4 top-2 bottom-2 w-px bg-gradient-to-b from-[rgba(139,92,246,0.3)] via-[rgba(139,92,246,0.15)] to-transparent" />

        <div className="space-y-3">
          {filtered.map((iter) => {
            const scoreColor = iter.score.total >= 85 ? '#22d3ee' : iter.score.total >= 70 ? '#fbbf24' : '#f87171'
            const shortId = iter.id.split('_').pop()?.slice(0, 6) || iter.id.slice(-6)
            return (
              <button key={iter.id} className="relative flex items-start gap-3 md:gap-4 group w-full text-left focus:outline-none focus:ring-2 focus:ring-[var(--accent)] rounded-xl" onClick={() => setSelected(iter)}>
                <div className="relative z-10 mt-1 w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center shrink-0 transition-all" style={{ background: `${scoreColor}15`, border: `1.5px solid ${scoreColor}`, boxShadow: `0 0 8px ${scoreColor}30` }}>
                  <span className="text-[9px] md:text-[10px] font-bold font-mono" style={{ color: scoreColor }}>{iter.score.total}</span>
                </div>

                <div className="flex-1 min-w-0 rounded-xl glass glass-hover p-3 md:p-4 transition-all duration-300">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-mono text-[var(--text-dim)]">#{shortId}</span>
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">{iter.timestamp}</span>
                    <div className="ml-auto flex items-center gap-1.5">
                      {iter.lessons_extracted > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded font-mono" style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }} title="Lessons extracted">{iter.lessons_extracted}L</span>}
                      {iter.proposals_made > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded font-mono" style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }} title="Proposals generated">{iter.proposals_made}P</span>}
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-mono text-[var(--text-muted)]" title="Tools used">{iter.tools_used}T</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-mono text-[var(--text-muted)]" title="Token usage">{iter.token_usage >= 1000 ? `${(iter.token_usage / 1000).toFixed(0)}k` : iter.token_usage}</span>
                    </div>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] line-clamp-2 group-hover:text-[var(--text)] transition-colors">{iter.task}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {selected && (
        <div className="mt-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)]/60 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Iteration detail</p>
              <h4 className="mt-1 text-base font-semibold text-[var(--text)]">{selected.id}</h4>
            </div>
            <button className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]" onClick={() => setSelected(null)}>Close</button>
          </div>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">{selected.task}</p>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
            <span className="rounded-lg bg-[var(--bg-base)]/60 p-2">Score<br /><strong>{selected.score.total}</strong></span>
            <span className="rounded-lg bg-[var(--bg-base)]/60 p-2">Lessons<br /><strong>{selected.lessons_extracted}</strong></span>
            <span className="rounded-lg bg-[var(--bg-base)]/60 p-2">Proposals<br /><strong>{selected.proposals_made}</strong></span>
            <span className="rounded-lg bg-[var(--bg-base)]/60 p-2">Tools<br /><strong>{selected.tools_used}</strong></span>
            <span className="rounded-lg bg-[var(--bg-base)]/60 p-2">Duration<br /><strong>{selected.duration_seconds}s</strong></span>
          </div>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] text-[var(--text-secondary)]">
            {Object.entries(selected.score).filter(([key]) => key !== 'total').map(([key, value]) => (
              <span key={key} className="rounded-lg border border-[var(--border-subtle)] p-2 capitalize">{key.replace(/_/g, ' ')}: <strong>{value}</strong></span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
