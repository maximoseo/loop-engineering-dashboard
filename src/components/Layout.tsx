import { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import type { JSX } from 'react'
import { useDashboard } from '../contexts/DashboardContext.tsx'
import { useAuth } from '../contexts/AuthContext.tsx'

type NavItem = { to: string; label: string; icon: string; group: 'Command' | 'Review' | 'History' }

const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: 'grid', group: 'Command' },
  { to: '/queue', label: 'Task queue', icon: 'terminal', group: 'Command' },
  { to: '/orchestrator', label: 'Orchestrator', icon: 'network', group: 'Command' },
  { to: '/proposals', label: 'Proposals', icon: 'sparkles', group: 'Review' },
  { to: '/evals', label: 'Evals', icon: 'check', group: 'Review' },
  { to: '/failures', label: 'Failures', icon: 'alert', group: 'History' },
]

const groups: NavItem['group'][] = ['Command', 'Review', 'History']

function NavIcon({ name }: { name: string }) {
  const icons: Record<string, JSX.Element> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    cycle: <><path d="M3 12a9 9 0 1 0 9-9" /><path d="M3 4v5h5" /></>,
    activity: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></>,
    sparkles: <><path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3z" /></>,
    check: <><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></>,
    alert: <><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></>,
    list: <><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>,
    database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></>,
    terminal: <><path d="M4 17l6-5-6-5" /><path d="M12 19h8" /></>,
    network: <><circle cx="6" cy="6" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="12" cy="18" r="2" /><path d="M8 7l3 8" /><path d="M16 7l-3 8" /><path d="M8 6h8" /></>,
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

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { live, lastUpdated, elapsed, refreshing, load, state } = useDashboard()
  const { user, logout } = useAuth()
  const running = live && state.is_loop_running

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
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                  end={item.to === '/'}
                >
                  <span className="nav-icon"><NavIcon name={item.icon} /></span>
                  <span>{item.label}</span>
                </NavLink>
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
          <button type="button" onClick={() => void load(true)} disabled={refreshing}>
            <NavIcon name="cycle" />
            {refreshing ? 'Syncing' : 'Refresh'}
          </button>
        </div>
        {user && (
          <div className="status-meta" style={{ marginTop: '0.45rem' }}>
            <span className="truncate" title={user.email}>{user.email}</span>
            <button type="button" onClick={() => void logout()}>Sign out</button>
          </div>
        )}
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text)]">
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-40 w-10 h-10 rounded-lg glass flex items-center justify-center text-[var(--text)]"
        aria-label="Open navigation"
        aria-expanded={mobileOpen}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Desktop sidebar */}
      <aside className="sidebar-shell hidden lg:flex">
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
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

      {/* Main content */}
      <main className="dashboard-main relative z-10">
        <Outlet />
      </main>
    </div>
  )
}
