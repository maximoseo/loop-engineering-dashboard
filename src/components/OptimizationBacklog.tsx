import type { BacklogItem } from '../types.ts'

interface Props {
  backlog: BacklogItem[]
}

const priorityConfig = {
  high: { color: 'var(--error)', bg: 'bg-[var(--error)]/20' },
  medium: { color: 'var(--warning)', bg: 'bg-[var(--warning)]/20' },
  low: { color: 'var(--text-muted)', bg: 'bg-[var(--text-muted)]/20' },
}

export function OptimizationBacklog({ backlog }: Props) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3 sm:p-5">
      <h2 className="text-sm font-semibold text-[var(--text-muted)] mb-4 uppercase tracking-wider">📋 Optimization Backlog</h2>
      <div className="space-y-2">
        {backlog.map((item) => {
          const pc = priorityConfig[item.priority]
          return (
            <div key={item.id} className="flex items-start gap-2 p-3 rounded-lg bg-[var(--bg-primary)]/50 hover:bg-[var(--bg-primary)] transition-colors">
              <div className={`mt-1 w-2 h-2 rounded-full ${item.status === 'in_progress' ? 'animate-pulse' : ''}`} style={{ background: pc.color }} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{item.title}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${pc.bg}`} style={{ color: pc.color }}>{item.priority}</span>
                  {item.status === 'in_progress' && (
                    <span className="text-xs text-[var(--warning)] animate-pulse">in progress</span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{item.description}</p>
                <p className="text-xs text-[var(--accent)] mt-0.5">{item.estimated_impact}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
