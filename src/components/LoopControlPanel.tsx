interface Props {
  isRunning: boolean
  live: boolean
}

export function LoopControlPanel({ isRunning, live }: Props) {
  const running = live && isRunning

  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${running ? 'bg-[var(--success)]/20 text-[var(--success)]' : 'bg-[var(--text-muted)]/20 text-[var(--text-muted)]'}`}
      >
        <div
          className={`w-2 h-2 rounded-full ${running ? 'bg-[var(--success)] animate-pulse' : 'bg-[var(--text-muted)]'}`}
        />
        {running ? 'Loop Active' : 'Loop Idle'}
      </div>
      <span
        className="px-3 py-1 rounded-lg text-xs font-medium bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-muted)] cursor-help"
        title="This dashboard is read-only. Loops are controlled locally on the host machine: python scripts/loopctl.py [status|run|approve|rollback]"
      >
        Local control
      </span>
    </div>
  )
}
