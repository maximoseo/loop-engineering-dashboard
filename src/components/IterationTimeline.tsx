import type { Iteration } from '../types.ts'

interface Props {
  iterations: Iteration[]
}

export function IterationTimeline({ iterations }: Props) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5">
      <h2 className="text-sm font-semibold text-[var(--text-muted)] mb-4 uppercase tracking-wider">Iteration History</h2>
      <div className="overflow-x-auto">
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
    </div>
  )
}
