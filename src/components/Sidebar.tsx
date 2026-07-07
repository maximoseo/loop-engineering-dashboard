import { useEffect, useState } from 'react'
import type { JSX } from 'react'

interface Props {
  isRunning: boolean
  live: boolean
  lastUpdated: Date | null
  elapsed: number
  refreshing: boolean
  onRefresh: () => void
}

type NavItem = { id: string; label: string; icon: string; group: 'Command' | 'Review' | 'History' }

const navItems: NavItem[] = [
  { id: 'overview', label: 'Command center', icon: 'grid', group: 'Command' },
  { id: 'task-intake', label: 'New task', icon: 'terminal', group: 'Command' },
  { id: 'production', label: 'Live data proof', icon: 'database', group: 'Command' },
  { id: 'loop', label: 'Loop phases', icon: 'cycle', group: 'Command' },
  { id: 'improvements', label: 'Proposals', icon: 'sparkles', group: 'Review' },
  { id: 'evals', label: 'Eval results', icon: 'check', group: 'Review' },
  { id: 'iterations', label: 'Iterations', icon: 'clock', group: 'History' },
  { id: 'failures', label: 'Failure library', icon: 'alert', group: 'History' },
  { id: 'backlog', label: 'Backlog', icon: 'list', group: 'History' },
]

const groups: NavItem['group'][] = ['Command', 'Review', 'History']

function NavIcon({ name }: { name: string }) {
  const icons: Record<string, JSX.Element> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    cycle: <><path d="M3 12a9 9 0 1 0 9-9" /><path d="M3 4v5h5" /></>,
    sparkles: <><path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3z" /></>,
    check: <><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></>,
    alert: <><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></>,
    list: <><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>,
    database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></>,
  }

  return (
    <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
  const [activeId, setActiveId] = useState('overview')
  const running = live && isRunning

  useEffect(() => {
    const sections = navItems
      .map((item) => document.getElementById(item.id))
      .filter((section): section is HTMLElement => Boolean(section))

    if (!sections.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible?.target.id) setActiveId(visible.target.id)
      },
      { rootMargin: '-18% 0px -65% 0px', threshold: [0.08, 0.2, 0.4] },
    )

    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [])

  const handleNav = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveId(id)
    setMobileOpen(false)
  }

  const sidebarContent = (
    <>
      <div className="sidebar-brand">
        <div className="brand-mark" aria-hidden="true">
          <span />
        </div>
        <div className="min-w-0">
          <h1>Loop Engineering</h1>
          <p>Agent quality control</p>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Dashboard sections">
        {groups.map((group) => (
          <div key={group} className="nav-group">
            <p>{group}</p>
            <div>
              {navItems.filter((item) => item.group === group).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNav(item.id)}
                  aria-current={activeId === item.id ? 'page' : undefined}
                  className="nav-item"
                >
                  <span className="nav-icon"><NavIcon name={item.icon} /></span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="sidebar-status" aria-label="Runtime status">
        <div className="status-topline">
          <span className={`runtime-dot ${running ? 'live' : ''}`} />
          <span>{running ? 'Loop active' : 'Loop idle'}</span>
          <strong>{live ? 'Live' : 'Demo'}</strong>
        </div>
        <div className="status-meta">
          <span>{lastUpdated ? formatElapsed(elapsed) : 'Not synced'}</span>
          <button type="button" onClick={onRefresh} disabled={refreshing}>
            <NavIcon name="cycle" />
            {refreshing ? 'Syncing' : 'Refresh'}
          </button>
        </div>
      </div>
    </>
  )

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-40 w-10 h-10 rounded-lg glass flex items-center justify-center text-[var(--text)]"
        aria-label="Open navigation"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      <aside className="sidebar-shell hidden lg:flex">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <>
          <button
            type="button"
            className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation overlay"
          />
          <aside className="sidebar-shell mobile-drawer lg:hidden animate-slide-in">
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
