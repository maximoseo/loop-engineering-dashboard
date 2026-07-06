import { useState } from 'react'

interface Props {
  isRunning: boolean
}

export function LoopControlPanel({ isRunning }: Props) {
  const [running, setRunning] = useState(isRunning)

  return (
    <div className="flex items-center gap-2">
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${running ? 'bg-[var(--success)]/20 text-[var(--success)]' : 'bg-[var(--text-muted)]/20 text-[var(--text-muted)]'}`}>
        <div className={`w-2 h-2 rounded-full ${running ? 'bg-[var(--success)] animate-pulse' : 'bg-[var(--text-muted)]'}`} />
        {running ? 'Loop Active' : 'Loop Paused'}
      </div>
      <button
        onClick={() => setRunning(!running)}
        className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${running ? 'bg-[var(--warning)]/20 text-[var(--warning)] hover:bg-[var(--warning)]/30' : 'bg-[var(--success)]/20 text-[var(--success)] hover:bg-[var(--success)]/30'}`}
      >
        {running ? '⏸ Pause' : '▶ Start'}
      </button>
    </div>
  )
}
