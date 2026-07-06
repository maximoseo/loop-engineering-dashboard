import type { FailurePattern } from '../types.ts'

interface Props {
  failures: FailurePattern[]
}

export function FailureLibrary({ failures }: Props) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5">
      <h2 className="text-sm font-semibold text-[var(--text-muted)] mb-4 uppercase tracking-wider">⚠️ Failure Library</h2>
      <div className="space-y-2">
        {failures.map((f) => (
          <div key={f.id} className="p-3 rounded-lg bg-[var(--bg-primary)]/50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">{f.pattern}</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${f.frequency > 5 ? 'bg-[var(--error)]/20 text-[var(--error)]' : 'bg-[var(--warning)]/20 text-[var(--warning)]'}`}>
                {f.frequency}×
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-[var(--text-dim)]">
              <span className="px-1.5 py-0.5 rounded bg-[var(--border)]">{f.category}</span>
              <span>Last: {f.last_seen}</span>
            </div>
            {f.mitigation && (
              <p className="text-xs text-[var(--success)] mt-1">✓ {f.mitigation}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
