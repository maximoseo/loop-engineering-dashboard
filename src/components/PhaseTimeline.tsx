import type { LoopPhase, LoopPhaseState, PhaseStatus } from '../types.ts'
import type { JSX } from 'react'

interface Props {
  phases: LoopPhaseState[]
  currentPhase: LoopPhase
}

const phaseOrder: LoopPhase[] = ['OBSERVING', 'SCORING', 'LEARNING', 'PROPOSING', 'TESTING', 'ACTIVATING', 'MONITORING']

const statusConfig: Record<PhaseStatus, { color: string; label: string }> = {
  pending: { color: 'rgba(139,92,246,0.25)', label: 'Pending' },
  active: { color: '#8b5cf6', label: 'Active' },
  done: { color: '#22d3ee', label: 'Done' },
  error: { color: '#f87171', label: 'Error' },
}

function PhaseIcon({ phase }: { phase: LoopPhase }) {
  const icons: Record<string, JSX.Element> = {
    OBSERVING: <><circle cx="12" cy="12" r="3" /><path d="M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24" /></>,
    SCORING: <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></>,
    LEARNING: <><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" /><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" /></>,
    PROPOSING: <><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></>,
    TESTING: <><path d="M9 2v6L4 14v8h16v-8l-5-6V2" /><line x1="9" y1="2" x2="15" y2="2" /></>,
    ACTIVATING: <><path d="M5 12h14M12 5l7 7-7 7" /></>,
    MONITORING: <><path d="M3 3v18h18" /><path d="M7 14l4-4 4 4 5-5" /></>,
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {icons[phase] ?? icons.OBSERVING}
    </svg>
  )
}

export function PhaseTimeline({ phases, currentPhase }: Props) {
  return (
    <div id="loop" className="rounded-2xl glass gradient-border p-5 md:p-6 animate-fade-in delay-1">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Phase Timeline</h3>
        <span className="text-xs text-[var(--text-dim)] font-mono">
          {phases.filter(p => p.status === 'done').length}/7 complete
        </span>
      </div>

      {/* Horizontal flow */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2 scroll-fade">
        {phaseOrder.map((phase, i) => {
          const state = phases.find(p => p.name === phase)
          const status = state?.status || 'pending'
          const cfg = statusConfig[status]
          const isCurrent = phase === currentPhase

          return (
            <div key={phase} className="flex items-center shrink-0">
              {/* Node */}
              <div className="flex flex-col items-center gap-2 min-w-[80px]">
                <div
                  className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${isCurrent ? 'animate-pulse-glow' : ''}`}
                  style={{
                    background: status === 'pending' ? 'rgba(139,92,246,0.05)' : `${cfg.color}15`,
                    border: `1.5px solid ${cfg.color}`,
                    color: cfg.color,
                    boxShadow: status === 'done' ? `0 0 12px ${cfg.color}30` : isCurrent ? `0 0 20px ${cfg.color}50` : 'none',
                  }}
                  title={`${phase}: ${cfg.label}${state?.detail ? ` — ${state.detail}` : ''}`}
                >
                  <PhaseIcon phase={phase} />
                </div>
                <span
                  className="text-[10px] font-medium uppercase tracking-wider text-center"
                  style={{ color: isCurrent ? 'var(--text)' : status === 'pending' ? 'var(--text-dim)' : 'var(--text-secondary)' }}
                >
                  {phase}
                </span>
                {state?.detail && (
                  <span className="text-[9px] text-[var(--text-dim)] font-mono text-center max-w-[80px] truncate">
                    {state.detail}
                  </span>
                )}
              </div>

              {/* Connector */}
              {i < phaseOrder.length - 1 && (
                <div className="h-0.5 w-6 md:w-10 rounded-full shrink-0" style={{
                  background: status === 'done' ? 'linear-gradient(90deg, #22d3ee, rgba(139,92,246,0.3))' : 'rgba(139,92,246,0.12)',
                }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
