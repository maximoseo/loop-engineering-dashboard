interface Props {
  avgScore: number
  totalIterations: number
  activated: number
  rolledBack: number
  scoreTrend: number[]
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null
  const w = 96
  const h = 28
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="metric-sparkline" aria-hidden="true">
      <defs>
        <linearGradient id="metricSpark" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="1" />
        </linearGradient>
      </defs>
      <polyline points={pts} fill="none" stroke="url(#metricSpark)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function MetricsSummary({ avgScore, totalIterations, activated, rolledBack, scoreTrend }: Props) {
  const latestScore = scoreTrend.at(-1) ?? avgScore
  const cards = [
    {
      label: 'Current score',
      value: `${latestScore}`,
      suffix: '/100',
      helper: 'Latest evaluated run',
      tone: latestScore >= 80 ? 'good' : latestScore >= 60 ? 'warn' : 'bad',
      spark: scoreTrend.slice(-12),
      context: 'quality signal',
    },
    {
      label: 'Iterations',
      value: `${totalIterations}`,
      suffix: '',
      helper: 'Live Supabase rows',
      tone: 'info',
      spark: [],
      context: 'run history',
    },
    {
      label: 'Active skills',
      value: `${activated}`,
      suffix: '',
      helper: 'Currently activated',
      tone: 'good',
      spark: [],
      context: 'learned assets',
    },
    {
      label: 'Rolled back',
      value: `${rolledBack}`,
      suffix: '',
      helper: rolledBack === 0 ? 'No rollback events' : 'Watch regressions',
      tone: rolledBack === 0 ? 'neutral' : 'bad',
      spark: [],
      context: 'risk control',
    },
  ]

  return (
    <section className="metrics-grid premium-metrics" aria-label="Operational metrics">
      {cards.map((card) => (
        <article key={card.label} className={`metric-card premium-card ${card.tone}`}>
          <div className="premium-card-core metric-card-core">
            <div className="metric-card-topline">
              <span>{card.context}</span>
              <Sparkline data={card.spark} />
            </div>
            <div className="metric-card-value-row">
              <strong>
                {card.value}
                {card.suffix && <span>{card.suffix}</span>}
              </strong>
            </div>
            <div className="metric-card-footer">
              <p>{card.label}</p>
              <small>{card.helper}</small>
            </div>
          </div>
        </article>
      ))}
    </section>
  )
}
