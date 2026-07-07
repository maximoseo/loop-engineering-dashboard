interface Props {
  avgScore: number
  totalIterations: number
  activated: number
  rolledBack: number
  scoreTrend: number[]
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const w = 60
  const h = 16
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="opacity-60">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function MetricsSummary({ avgScore, totalIterations, activated, rolledBack, scoreTrend }: Props) {
  const cards = [
    {
      label: 'Avg Score (7d)',
      value: `${avgScore}`,
      suffix: '/100',
      color: avgScore >= 70 ? '#22d3ee' : avgScore >= 50 ? '#fbbf24' : '#f87171',
      spark: scoreTrend.slice(-10),
      icon: <><path d="M3 3v18h18" /><path d="M7 14l4-4 4 4 5-5" /></>,
    },
    {
      label: 'Iterations',
      value: `${totalIterations}`,
      suffix: '',
      color: '#60a5fa',
      spark: scoreTrend.map((_, i) => i + 1),
      icon: <><path d="M3 12a9 9 0 1 0 9-9" /><path d="M3 4v5h5" /></>,
    },
    {
      label: 'Active Skills',
      value: `${activated}`,
      suffix: '',
      color: '#22d3ee',
      spark: [1, 1, 1, 2, 2, 2, activated].slice(-7),
      icon: <><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" /></>,
    },
    {
      label: 'Rolled Back',
      value: `${rolledBack}`,
      suffix: '',
      color: '#f87171',
      spark: [0, 0, 0, 0, 0, 0, rolledBack].slice(-7),
      icon: <><path d="M3 7v6h6" /><path d="M21 17a9 9 0 00-15-6.7L3 13" /></>,
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {cards.map((card, i) => (
        <div
          key={card.label}
          className="relative overflow-hidden rounded-xl glass glass-hover gradient-border p-4 md:p-5 transition-all duration-300 animate-fade-in"
          style={{ animationDelay: `${0.1 + i * 0.08}s` }}
        >
          {/* Accent glow */}
          <div
            className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10 pointer-events-none"
            style={{ background: `radial-gradient(circle, ${card.color}, transparent 70%)` }}
          />
          <div className="relative flex items-start justify-between mb-3">
            <span className="text-[10px] md:text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">{card.label}</span>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${card.color}15`, color: card.color }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {card.icon}
              </svg>
            </div>
          </div>
          <div className="relative flex items-end justify-between">
            <div className="text-2xl md:text-3xl font-bold font-mono" style={{ color: card.color }}>
              {card.value}
              {card.suffix && <span className="text-sm text-[var(--text-muted)]">{card.suffix}</span>}
            </div>
            <div className="mb-1">
              <Sparkline data={card.spark} color={card.color} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
