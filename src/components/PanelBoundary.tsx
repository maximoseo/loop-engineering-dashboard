import * as Sentry from '@sentry/react'
import type { ReactNode } from 'react'

/**
 * Isolates a dashboard section so a render error in one panel shows a small
 * fallback instead of blanking the whole dashboard (top-level boundary only
 * lives in main.tsx). Works with or without Sentry initialised.
 */
export function PanelBoundary({ children, label = 'section' }: { children: ReactNode; label?: string }) {
  return (
    <Sentry.ErrorBoundary
      fallback={
        <div className="glass-card" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <p className="text-sm text-[var(--error)]">This {label} hit an error and could not render.</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">The rest of the dashboard is unaffected.</p>
        </div>
      }
    >
      {children}
    </Sentry.ErrorBoundary>
  )
}
