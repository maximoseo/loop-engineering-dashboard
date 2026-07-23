import { Component, type ReactNode, type ErrorInfo } from 'react'

interface State {
  hasError: boolean
  message?: string
}

/** Catches render errors in child components and shows a reload prompt instead of a white screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="dashboard-content flex flex-col items-center justify-center gap-4 py-20">
          <p className="text-sm text-[var(--text-dim)]">
            Something went wrong loading this page.
          </p>
          {this.state.message && (
            <p className="font-mono text-xs text-[var(--text-muted)]">{this.state.message}</p>
          )}
          <button
            onClick={() => window.location.reload()}
            className="action-button primary"
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
