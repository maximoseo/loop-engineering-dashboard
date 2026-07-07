import type { Iteration } from '../types.ts'

interface Props {
  iterations: Iteration[]
}

export function IterationTimeline({ iterations }: Props) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3 sm:p-5">
      <h2 className="text-sm font-semibold text-[var(--text-muted)] mb-4 uppercase tracking-wider">Iteration History</h2>

      {/* Desktop table (md and up) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[var(--text-muted)] border-b border-[var(--border)]">
              <th className="pb-2 pr-4">ID</th>
              <th className="pb-2 pr-4">Time</th>
              <th className="pb-2 pr-4">Task</th>
              <th className="pb-2 pr-4 text-center">Score</th>
              <th className="pb-2 pr-4 text-center">Lessons</th>
              <th className="pb-2 pr-4 text-center">Proposals</th>
              <th className="pb-2 pr-4 text-center">Tools</th>
              <th className="pb-2 text-center">Tokens</th>
            </tr>
          </thead>
          <tbody>
            {iterations.map((iter) => {
              const scoreColor = iter.score.total >= 85 ? 'var(--success)' : iter.score.total >= 70 ? 'var(--warning)' : 'var(--error)'
              return (
                <tr key={iter.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition-colors">
                  <td className="py-2 pr-4 font-mono text-xs text-[var(--text-muted)]">#{iter.id}</td>
                  <td className="py-2 pr-4 text-xs text-[var(--text-muted)]">{iter.timestamp}</td>
                  <td className="py-2 pr-4 truncate max-w-xs">{iter.task}</td>
                  <td className="py-2 pr-4 text-center">
                    <span className="font-semibold" style={{ color: scoreColor }}>{iter.score.total}</span>
                  </td>
                  <td className="py-2 pr-4 text-center text-[var(--text-muted)]">{iter.lessons_extracted}</td>
                  <td className="py-2 pr-4 text-center">
                    {iter.proposals_made > 0 ? (
                      <span className="text-[var(--accent)]">{iter.proposals_made}</span>
                    ) : (
                      <span className="text-[var(--text-dim)]">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-center text-[var(--text-muted)]">{iter.tools_used}</td>
                  <td className="py-2 text-center text-xs text-[var(--text-muted)]">{iter.token_usage.toLocaleString()}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards (below md) */}
      <div className="md:hidden space-y-3">
        {iterations.map((iter) => {
          const scoreColor = iter.score.total >= 85 ? 'var(--success)' : iter.score.total >= 70 ? 'var(--warning)' : 'var(--error)'
          return (
            <div key={iter.id} className="border border-[var(--border)] rounded-lg p-3 bg-[var(--bg-primary)]/40">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs text-[var(--text-muted)]">#{iter.id}</span>
                <span className="text-lg font-bold" style={{ color: scoreColor }}>{iter.score.total}</span>
              </div>
              <p className="text-sm mb-2 line-clamp-2">{iter.task}</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
                <span>{iter.timestamp}</span>
                <span title="Lessons extracted">Lessons: {iter.lessons_extracted}</span>
                <span title="Proposals generated">Proposals: {iter.proposals_made}</span>
                <span title="Tools used">Tools: {iter.tools_used}</span>
                <span title="Token usage">Tokens: {iter.token_usage.toLocaleString()}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
