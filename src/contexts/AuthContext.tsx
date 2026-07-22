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
  loading: boolean // login/signup action in flight
  initializing: boolean // first getSession() pending — gate redirects on this
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  getAccessToken: () => string | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

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
      // Redirect to reset-password page when arriving via a recovery email link
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
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const signup = useCallback(async (email: string, password: string) => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({ email, password })
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
      value={{ user, session, loading, initializing, login, signup, logout, getAccessToken }}
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
