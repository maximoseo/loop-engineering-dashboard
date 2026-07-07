import type { LoopPhase, LoopPhaseState } from '../types.ts'

interface Props {
  phases: LoopPhaseState[]
  currentPhase: LoopPhase
  isRunning: boolean
  avgScore: number
  totalIterations: number
}

const phaseOrder: LoopPhase[] = ['OBSERVING', 'SCORING', 'LEARNING', 'PROPOSING', 'TESTING', 'ACTIVATING', 'MONITORING']

const phaseColors: Record<LoopPhase, string> = {
  IDLE: '#52525b',
  OBSERVING: '#60a5fa',
  SCORING: '#a78bfa',
  LEARNING: '#8b5cf6',
  PROPOSING: '#06b6d4',
  TESTING: '#fbbf24',
  ACTIVATING: '#22d3ee',
  MONITORING: '#10b981',
}

export function HeroPhase({ phases, currentPhase, isRunning, avgScore, totalIterations }: Props) {
  const doneCount = phases.filter(p => p.status === 'done').length
  const progress = (doneCount / 7) * 100
  const currentColor = phaseColors[currentPhase] || '#8b5cf6'

  // Circular gauge segments
  const radius = 80
  const circumference = 2 * Math.PI * radius
  const segmentLength = circumference / 7

  return (
    <div id="overview" className="relative overflow-hidden rounded-2xl glass gradient-border p-6 md:p-8 animate-fade-in">
      {/* Glow backdrop */}
      <div
        className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-20 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${currentColor}, transparent 60%)` }}
      />

      <div className="relative flex flex-col md:flex-row items-center gap-6 md:gap-10">
        {/* Circular gauge */}
        <div className="relative shrink-0">
          <svg width="200" height="200" viewBox="0 0 200 200" className="w-40 h-40 md:w-48 md:h-48">
            {/* Track */}
            <circle cx="100" cy="100" r={radius} fill="none" stroke="rgba(139,92,246,0.08)" strokeWidth="8" />

            {/* Segments */}
            {phaseOrder.map((phase, i) => {
              const state = phases.find(p => p.name === phase)
              const status = state?.status || 'pending'
              const startAngle = (i / 7) * 360 - 90
              const endAngle = ((i + 1) / 7) * 360 - 90
              const x1 = 100 + radius * Math.cos((startAngle * Math.PI) / 180)
              const y1 = 100 + radius * Math.sin((startAngle * Math.PI) / 180)
              const x2 = 100 + radius * Math.cos((endAngle * Math.PI) / 180)
              const y2 = 100 + radius * Math.sin((endAngle * Math.PI) / 180)
              const largeArc = segmentLength > circumference / 2 ? 1 : 0

              const segColor = status === 'done' ? '#22d3ee' : status === 'active' ? currentColor : 'rgba(139,92,246,0.12)'
              const segWidth = status === 'pending' ? 4 : 8

              return (
                <path
                  key={phase}
                  d={`M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`}
                  fill="none"
                  stroke={segColor}
                  strokeWidth={segWidth}
                  strokeLinecap="round"
                  opacity={status === 'active' ? 1 : status === 'done' ? 0.8 : 0.4}
                  className={status === 'active' ? 'animate-pulse-glow' : ''}
                  style={status === 'done' ? { filter: 'drop-shadow(0 0 4px rgba(34,211,238,0.5))' } : status === 'active' ? { filter: `drop-shadow(0 0 6px ${currentColor})` } : {}}
                />
              )
            })}

            {/* Center text */}
            <text x="100" y="92" textAnchor="middle" className="fill-[var(--text)] font-bold" style={{ fontSize: '28px', fontFamily: 'var(--font-sans)' }}>
              {Math.round(progress)}%
            </text>
            <text x="100" y="115" textAnchor="middle" className="fill-[var(--text-muted)]" style={{ fontSize: '10px', fontFamily: 'var(--font-sans)', letterSpacing: '0.1em' }}>
              {doneCount}/7 PHASES
            </text>
          </svg>
        </div>

        {/* Phase info */}
        <div className="flex-1 text-center md:text-left">
          <div className="flex flex-wrap items-center gap-2 justify-center md:justify-start mb-3">
            <span className="rounded-full border border-[var(--accent-cyan)]/25 bg-[var(--accent-cyan)]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--accent-cyan)]">
              Self-improving agent loop
            </span>
            <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-base)]/50 px-3 py-1 text-[11px] font-mono text-[var(--text-secondary)]">
              {isRunning ? 'running now' : 'waiting for next run'}
            </span>
          </div>
          <h2
            className="text-3xl md:text-5xl lg:text-6xl font-bold mb-3 tracking-[-0.05em]"
            style={{ color: isRunning ? currentColor : 'var(--text)', textShadow: isRunning ? `0 0 30px ${currentColor}40` : 'none' }}
          >
            Agent quality control, not just charts.
          </h2>
          <p className="text-sm md:text-base text-[var(--text-secondary)] mb-5 max-w-2xl leading-7">
            Current phase: <strong className="text-[var(--text)]">{isRunning ? currentPhase : 'IDLE'}</strong>. The dashboard watches real loop telemetry, explains what the agents are learning, and gives operators safe approval handoffs before changes go live.
          </p>

          {/* Quick stats inline */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 justify-center md:justify-start">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)]/45 px-4 py-3">
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-0.5">Avg Score</div>
              <div className="text-xl font-bold font-mono" style={{ color: avgScore >= 70 ? 'var(--success)' : avgScore >= 50 ? 'var(--warning)' : 'var(--error)' }}>
                {avgScore}<span className="text-xs text-[var(--text-muted)]">/100</span>
              </div>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)]/45 px-4 py-3">
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-0.5">Iterations</div>
              <div className="text-xl font-bold font-mono text-[var(--text)]">{totalIterations}</div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <a href="#agent-ops" className="action-button primary">Understand & operate</a>
              <a href="#improvements" className="action-button">Review proposals</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
