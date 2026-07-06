import type { LoopPhaseState, LoopPhase, PhaseStatus } from '../types.ts'

interface Props {
  phases: LoopPhaseState[]
  currentPhase: LoopPhase
}

const phaseOrder: LoopPhase[] = ['OBSERVING', 'SCORING', 'LEARNING', 'PROPOSING', 'TESTING', 'ACTIVATING', 'MONITORING']

const statusConfig: Record<PhaseStatus, { icon: string; color: string; label: string }> = {
  pending: { icon: '○', color: 'var(--text-dim)', label: 'Pending' },
  active: { icon: '⟳', color: 'var(--warning)', label: 'Active' },
  done: { icon: '✓', color: 'var(--success)', label: 'Done' },
  error: { icon: '✗', color: 'var(--error)', label: 'Error' },
}

export function LoopVisualization({ phases, currentPhase }: Props) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 h-full">
      <h2 className="text-sm font-semibold text-[var(--text-muted)] mb-4 uppercase tracking-wider">Loop Visualization</h2>
      <div className="space-y-3">
        {phaseOrder.map((phase, i) => {
          const state = phases.find(p => p.name === phase)
          const status = state?.status || 'pending'
          const cfg = statusConfig[status]
          const isCurrent = phase === currentPhase

          return (
            <div key={phase} className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                  isCurrent ? 'animate-pulse-glow' : ''
                }`}
                style={{
                  color: cfg.color,
                  borderColor: cfg.color,
                  background: isCurrent ? `${cfg.color}15` : 'transparent',
                }}
              >
                {status === 'active' ? <span className="animate-spin-slow">{cfg.icon}</span> : cfg.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${isCurrent ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'}`}>
                    {phase}
                  </span>
                  {state?.detail && (
                    <span className="text-xs text-[var(--text-dim)]">{state.detail}</span>
                  )}
                </div>
                {state?.timestamp && (
                  <span className="text-xs text-[var(--text-dim)] font-mono">{state.timestamp}</span>
                )}
              </div>
              {i < phaseOrder.length - 1 && (
                <div className="absolute" style={{ display: 'none' }} />
              )}
            </div>
          )
        })}
      </div>
      {/* Loop indicator */}
      <div className="mt-4 pt-4 border-t border-[var(--border)]">
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 1 0 9-9" />
            <path d="M3 4v5h5" />
          </svg>
          <span>Loop running — {phases.filter(p => p.status === 'done').length}/7 phases complete</span>
        </div>
      </div>
    </div>
  )
}
