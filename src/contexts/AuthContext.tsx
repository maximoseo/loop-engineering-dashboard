import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase.ts'

interface AuthContextValue {
  user: { email: string } | null
  session: Session | null
  loading: boolean
  initializing: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  getAccessToken: () => string | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

// ponytail: client-side login throttle. Supabase platform rate-limits the auth
// endpoint server-side; this stops UI-driven credential stuffing. 5 attempts
// per 60s window, tracked in-memory (resets on reload — acceptable for a UI guard).
const LOGIN_WINDOW_MS = 60_000
const LOGIN_MAX_ATTEMPTS = 5
let loginAttempts: number[] = []

function loginThrottle(): { allowed: boolean; retryAfter: number } {
  const now = Date.now()
  loginAttempts = loginAttempts.filter((t) => now - t < LOGIN_WINDOW_MS)
  if (loginAttempts.length >= LOGIN_MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((LOGIN_WINDOW_MS - (now - loginAttempts[0])) / 1000)
    return { allowed: false, retryAfter }
  }
  return { allowed: true, retryAfter: 0 }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return
        setSession(data.session)
      })
      .finally(() => {
        if (active) setInitializing(false)
      })
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (event === 'PASSWORD_RECOVERY') {
        window.location.assign('/reset-password')
      }
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const throttle = loginThrottle()
    if (!throttle.allowed) {
      throw new Error(`Too many login attempts. Try again in ${throttle.retryAfter}s.`)
    }
    loginAttempts.push(Date.now())
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const getAccessToken = useCallback(() => session?.access_token ?? null, [session])

  const user = session?.user?.email ? { email: session.user.email } : null

  return (
    <AuthContext.Provider
      value={{ user, session, loading, initializing, login, logout, getAccessToken }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
