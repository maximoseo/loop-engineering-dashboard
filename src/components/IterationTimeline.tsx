import type { Iteration } from '../types.ts'

interface Props {
  iterations: Iteration[]
}

export function IterationTimeline({ iterations }: Props) {
  return (
    <div id="iterations" className="rounded-2xl glass gradient-border p-5 md:p-6 animate-fade-in delay-4">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Iteration History</h3>
        <span className="text-xs text-[var(--text-dim)] font-mono">{iterations.length} recent</span>
      </div>

      {/* Vertical rail timeline */}
      <div className="relative">
        {/* Rail line */}
        <div className="absolute left-3 md:left-4 top-2 bottom-2 w-px bg-gradient-to-b from-[rgba(139,92,246,0.3)] via-[rgba(139,92,246,0.15)] to-transparent" />

        <div className="space-y-3">
          {iterations.map((iter) => {
            const scoreColor = iter.score.total >= 85 ? '#22d3ee' : iter.score.total >= 70 ? '#fbbf24' : '#f87171'
            const shortId = iter.id.split('_').pop()?.slice(0, 6) || iter.id.slice(-6)
            return (
              <div key={iter.id} className="relative flex items-start gap-3 md:gap-4 group">
                {/* Rail dot */}
                <div
                  className="relative z-10 mt-1 w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center shrink-0 transition-all"
                  style={{
                    background: `${scoreColor}15`,
                    border: `1.5px solid ${scoreColor}`,
                    boxShadow: `0 0 8px ${scoreColor}30`,
                  }}
                >
                  <span className="text-[9px] md:text-[10px] font-bold font-mono" style={{ color: scoreColor }}>
                    {iter.score.total}
                  </span>
                </div>

                {/* Card */}
                <div className="flex-1 min-w-0 rounded-xl glass glass-hover p-3 md:p-4 transition-all duration-300">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-mono text-[var(--text-dim)]">#{shortId}</span>
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">{iter.timestamp}</span>
                    <div className="ml-auto flex items-center gap-1.5">
                      {iter.lessons_extracted > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-mono" style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }} title="Lessons extracted">
                          {iter.lessons_extracted}L
                        </span>
                      )}
                      {iter.proposals_made > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-mono" style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }} title="Proposals generated">
                          {iter.proposals_made}P
                        </span>
                      )}
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-mono text-[var(--text-muted)]" title="Tools used">
                        {iter.tools_used}T
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-mono text-[var(--text-muted)]" title="Token usage">
                        {iter.token_usage >= 1000 ? `${(iter.token_usage / 1000).toFixed(0)}k` : iter.token_usage}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] line-clamp-2 group-hover:text-[var(--text)] transition-colors">
                    {iter.task}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
