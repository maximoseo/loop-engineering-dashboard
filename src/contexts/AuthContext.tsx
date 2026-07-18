import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface AuthState {
  user: { email: string } | null
  loading: boolean
}

interface AuthContextValue extends AuthState {
  login: (email: string, _password: string) => Promise<void>
  signup: (email: string, _password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ email: string } | null>(null)
  const [loading, setLoading] = useState(false)

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const login = useCallback(async (email: string, _password: string) => {
    setLoading(true)
    // TODO: replace with real auth
    await new Promise((r) => setTimeout(r, 600))
    setUser({ email })
    setLoading(false)
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const signup = useCallback(async (email: string, _password: string) => {
    setLoading(true)
    // TODO: replace with real auth
    await new Promise((r) => setTimeout(r, 600))
    setUser({ email })
    setLoading(false)
  }, [])

  const logout = useCallback(() => {
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
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
