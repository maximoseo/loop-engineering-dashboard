import { useState } from 'react'
import type { JSX } from 'react'

interface Props {
  isRunning: boolean
  live: boolean
  lastUpdated: Date | null
  elapsed: number
  refreshing: boolean
  onRefresh: () => void
}

const navItems = [
  { id: 'overview', label: 'Overview', icon: 'grid' },
  { id: 'agent-ops', label: 'Agent Ops', icon: 'terminal' },
  { id: 'loop', label: 'Loop Phases', icon: 'cycle' },
  { id: 'improvements', label: 'Improvements', icon: 'sparkles' },
  { id: 'evals', label: 'Eval Results', icon: 'check' },
  { id: 'iterations', label: 'Iterations', icon: 'clock' },
  { id: 'failures', label: 'Failures', icon: 'alert' },
  { id: 'backlog', label: 'Backlog', icon: 'list' },
]

function NavIcon({ name }: { name: string }) {
  const icons: Record<string, JSX.Element> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    cycle: <><path d="M3 12a9 9 0 1 0 9-9" /><path d="M3 4v5h5" /></>,
    sparkles: <><path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3z" /></>,
    check: <><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></>,
    alert: <><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></>,
    list: <><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>,
    terminal: <><path d="M4 17l6-5-6-5" /><path d="M12 19h8" /><rect x="2.5" y="4" width="19" height="16" rx="2" /></>,
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {icons[name] ?? icons.grid}
    </svg>
  )
}

const formatElapsed = (s: number) => {
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

export function Sidebar({ isRunning, live, lastUpdated, elapsed, refreshing, onRefresh }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const running = live && isRunning

  const handleNav = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setMobileOpen(false)
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-[var(--border-subtle)]">
        <div className="relative w-10 h-10 shrink-0 rounded-xl bg-[var(--accent)]/15 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
            <circle cx="12" cy="12" r="8" strokeDasharray="3 3" />
            <circle cx="12" cy="12" r="3" fill="var(--accent)" />
            <circle cx="12" cy="4" r="1.5" fill="var(--success)" />
            <circle cx="20" cy="12" r="1.5" fill="var(--warning)" />
            <circle cx="12" cy="20" r="1.5" fill="var(--error)" />
            <circle cx="4" cy="12" r="1.5" fill="var(--info)" />
          </svg>
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-bold text-[var(--text)] truncate">Loop Engineering</h1>
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Dashboard</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleNav(item.id)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--accent)]/10 transition-all duration-200 group"
          >
            <span className="text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors">
              <NavIcon name={item.icon} />
            </span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Status footer */}
      <div className="px-4 py-4 border-t border-[var(--border-subtle)] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${running ? 'bg-[var(--success)] animate-pulse' : 'bg-[var(--text-muted)]'}`} />
            <span className="text-xs text-[var(--text-secondary)]">{running ? 'Loop Active' : 'Loop Idle'}</span>
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${live ? 'bg-[var(--success)]/15 text-[var(--success)]' : 'bg-[var(--warning)]/15 text-[var(--warning)]'}`}
          >
            {live ? 'LIVE' : 'DEMO'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          {lastUpdated && (
            <span className="text-[10px] text-[var(--text-muted)] font-mono">{formatElapsed(elapsed)}</span>
          )}
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] border border-[var(--border-default)] hover:border-[var(--border-glow)] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all disabled:opacity-40"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={refreshing ? 'animate-spin-slow' : ''}>
              <path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" />
            </svg>
            {refreshing ? 'Syncing' : 'Refresh'}
          </button>
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-40 w-10 h-10 rounded-lg glass flex items-center justify-center text-[var(--text)]"
        aria-label="Open navigation"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-52 flex-col glass border-r border-[var(--border-subtle)] z-30">
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="lg:hidden fixed left-0 top-0 bottom-0 w-64 flex flex-col glass border-r border-[var(--border-glow)] z-50 animate-slide-in">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-3 w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)]"
              aria-label="Close navigation"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  )
}
