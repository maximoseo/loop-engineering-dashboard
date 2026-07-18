import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.tsx'

interface Props {
  children: ReactNode
}

export function AuthGuard({ children }: Props) {
  const { loading, user } = useAuth()

  // While Supabase is hydrating the session from local storage, show a
  // branded spinner so the user doesn't see a flash of the login page.
  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          {/* Spinner */}
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 animate-spin-slow rounded-full border-2 border-transparent border-t-[var(--accent-cyan)] opacity-80" />
            <div className="absolute inset-0 animate-spin-slow rounded-full border-2 border-transparent border-b-[var(--accent)] opacity-60" style={{ animationDirection: 'reverse', animationDuration: '3s' }} />
          </div>
          <p className="text-sm font-medium text-[var(--text-muted)] tracking-wide">
            Authenticating…
          </p>
        </div>
      </div>
    )
  }

  // Not authenticated → redirect to login
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Authenticated → render the protected content
  return <>{children}</>
}
