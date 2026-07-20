import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const routes = [
  { path: '/', label: 'Dashboard' },
  { path: '/queue', label: 'Task queue' },
  { path: '/orchestrator', label: 'Orchestrator' },
  { path: '/proposals', label: 'Proposals' },
  { path: '/evals', label: 'Evals' },
  { path: '/analytics', label: 'Analytics' },
  { path: '/lessons', label: 'Lessons' },
  { path: '/activations', label: 'Activation ledger' },
  { path: '/cost', label: 'Cost analytics' },
  { path: '/failures', label: 'Failures' },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((value) => !value)
      }
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const filtered = useMemo(
    () => routes.filter((r) => r.label.toLowerCase().includes(query.toLowerCase())),
    [query],
  )

  if (!open) return null

  const go = (path: string) => {
    setOpen(false)
    setQuery('')
    navigate(path)
  }

  return (
    <div className="task-detail-backdrop" role="presentation" onClick={() => setOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-md rounded-2xl border border-[var(--border-glow)] bg-[var(--bg-elevated)] p-2 shadow-2xl"
        style={{ marginTop: '12vh' }}
        onClick={(event) => event.stopPropagation()}
      >
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Jump to… (⌘K)"
          className="w-full rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)] outline-none"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && filtered[0]) go(filtered[0].path)
          }}
        />
        <ul className="mt-2 max-h-72 overflow-auto">
          {filtered.map((r) => (
            <li key={r.path}>
              <button
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-glass)] hover:text-[var(--text)]"
                onClick={() => go(r.path)}
              >
                {r.label}
                <span className="ml-2 text-[10px] text-[var(--text-dim)]">{r.path}</span>
              </button>
            </li>
          ))}
          {!filtered.length && <li className="px-3 py-2 text-sm text-[var(--text-dim)]">No matches</li>}
        </ul>
      </div>
    </div>
  )
}
