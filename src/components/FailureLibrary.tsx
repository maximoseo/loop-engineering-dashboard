import { useState } from 'react'
import type { FailurePattern } from '../types.ts'

interface Props {
  failures: FailurePattern[]
}

export function FailureLibrary({ failures }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div id="failures" className="rounded-2xl glass gradient-border p-5 md:p-6 animate-fade-in delay-5">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Failure Library</h3>
        <span className="text-xs text-[var(--text-dim)] font-mono">{failures.length} patterns</span>
      </div>
      <div className="space-y-2">
        {failures.map((f) => {
          const isOpen = expanded === f.id
          const freqColor = f.frequency > 5 ? '#f87171' : f.frequency > 2 ? '#fbbf24' : '#71717a'
          return (
            <div
              key={f.id}
              className="rounded-xl glass glass-hover overflow-hidden transition-all duration-300 cursor-pointer"
              onClick={() => setExpanded(isOpen ? null : f.id)}
            >
              <div className="flex items-center gap-3 p-3 md:p-4">
                <div
                  className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0 font-mono text-xs font-bold"
                  style={{ background: `${freqColor}15`, color: freqColor, border: `1px solid ${freqColor}40` }}
                >
                  {f.frequency}
                </div>
                <p className="text-sm text-[var(--text-secondary)] flex-1 line-clamp-1">{f.pattern}</p>
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider shrink-0"
                  style={{ background: `${freqColor}12`, color: freqColor }}
                >
                  {f.category}
                </span>
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"
                  className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
              {isOpen && (
                <div className="px-4 pb-4 pt-1 space-y-2 animate-fade-in">
                  <div className="flex items-center gap-2 text-xs text-[var(--text-dim)] font-mono">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" />
                    </svg>
                    Last seen: {f.last_seen}
                  </div>
                  {f.mitigation && (
                    <div className="flex items-start gap-2 text-xs text-[var(--success)] bg-[rgba(34,211,238,0.05)] rounded-lg p-2.5">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0">
                        <path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" />
                      </svg>
                      <span>{f.mitigation}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
