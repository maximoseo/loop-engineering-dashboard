interface Props {
  avgScore: number
  totalIterations: number
  activated: number
  rolledBack: number
}

export function MetricsSummary({ avgScore, totalIterations, activated, rolledBack }: Props) {
  const cards = [
    { label: 'Avg Score (7d)', value: `${avgScore}/100`, color: 'var(--accent)', icon: '📊' },
    { label: 'Iterations', value: totalIterations.toString(), color: 'var(--info)', icon: '🔄' },
    { label: 'Improvements Active', value: activated.toString(), color: 'var(--success)', icon: '✅' },
    { label: 'Rolled Back', value: rolledBack.toString(), color: 'var(--error)', icon: '↩️' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div key={card.label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 hover:border-[var(--border-hover)] transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[var(--text-muted)]">{card.label}</span>
            <span className="text-lg">{card.icon}</span>
          </div>
          <div className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</div>
        </div>
      ))}
    </div>
  )
}
