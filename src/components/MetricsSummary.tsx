interface Props {
  avgScore: number
  totalIterations: number
  activated: number
  rolledBack: number
  scoreTrend: number[]
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null
  const w = 72
  const h = 18
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
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
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
    },
    {
      label: 'Iterations',
      value: `${totalIterations}`,
      suffix: '',
      helper: 'Live Supabase rows',
      tone: 'info',
      spark: scoreTrend.map((_, i) => i + 1).slice(-12),
    },
    {
      label: 'Active skills',
      value: `${activated}`,
      suffix: '',
      helper: 'Currently activated',
      tone: 'good',
      spark: [1, 1, 1, 2, 2, 2, activated].slice(-7),
    },
    {
      label: 'Rolled back',
      value: `${rolledBack}`,
      suffix: '',
      helper: rolledBack === 0 ? 'No rollback events' : 'Watch regressions',
      tone: rolledBack === 0 ? 'neutral' : 'bad',
      spark: [0, 0, 0, 0, 0, 0, rolledBack].slice(-7),
    },
  ]

  return (
    <section className="metrics-grid" aria-label="Operational metrics">
      {cards.map((card) => (
        <article key={card.label} className={`metric-card ${card.tone}`}>
          <div>
            <p>{card.label}</p>
            <strong>
              {card.value}
              {card.suffix && <span>{card.suffix}</span>}
            </strong>
            <small>{card.helper}</small>
          </div>
          <Sparkline data={card.spark} />
        </article>
      ))}
    </section>
  )
}
