import type { BacklogItem } from '../types.ts'

interface Props {
  backlog: BacklogItem[]
}

const priorityConfig = {
  high: { color: '#f87171', label: 'High' },
  medium: { color: '#fbbf24', label: 'Medium' },
  low: { color: '#71717a', label: 'Low' },
}

export function OptimizationBacklog({ backlog }: Props) {
  const groups = {
    high: backlog.filter(b => b.priority === 'high'),
    medium: backlog.filter(b => b.priority === 'medium'),
    low: backlog.filter(b => b.priority === 'low'),
  }

  return (
    <section id="backlog" className="premium-panel backlog-panel animate-fade-in delay-5" aria-label="Optimization backlog">
      <div className="premium-panel-core">
      <div className="panel-heading-row compact">
        <div>
          <p className="panel-kicker">next actions</p>
          <h3>Optimization backlog</h3>
          <span>Prioritized opportunities grouped by operational impact.</span>
        </div>
        <strong className="panel-count">{backlog.length}</strong>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(['high', 'medium', 'low'] as const).map((pri) => {
          const pc = priorityConfig[pri]
          const items = groups[pri]
          return (
            <div key={pri} className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full" style={{ background: pc.color, boxShadow: `0 0 6px ${pc.color}60` }} />
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: pc.color }}>{pc.label}</span>
                <span className="text-[10px] text-[var(--text-dim)] font-mono ml-auto">{items.length}</span>
              </div>
              {items.map((item) => (
                <div key={item.id} className="rounded-xl glass glass-hover p-3 transition-all duration-300">
                  <div className="flex items-start gap-2 mb-2">
                    <div
                      className={`mt-1 w-2 h-2 rounded-full shrink-0 ${item.status === 'in_progress' ? 'animate-pulse' : ''}`}
                      style={{ background: pc.color }}
                    />
                    <p className="text-xs font-medium text-[var(--text)] line-clamp-2">{item.title}</p>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] line-clamp-2 mb-2">{item.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[var(--accent-bright)] font-mono truncate" title={item.estimated_impact}>
                      {item.estimated_impact}
                    </span>
                    {item.status === 'in_progress' && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wider" style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}>
                        WIP
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <p className="text-[10px] text-[var(--text-dim)] text-center py-4">No items</p>
              )}
            </div>
          )
        })}
      </div>
      </div>
    </section>
  )
}
