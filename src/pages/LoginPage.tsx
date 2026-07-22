import { useAuth } from '../contexts/AuthContext.tsx'
import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'

export default function LoginPage() {
  const { login, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed. Check your credentials and try again.')
    }
  }

  return (
    <div className="login-screen">
      <div className="login-orb login-orb-a" aria-hidden="true" />
      <div className="login-orb login-orb-b" aria-hidden="true" />

      <div className="login-card">
        <div className="login-brand">
          <span className="login-mark" aria-hidden="true">
            <span />
          </span>
          <div>
            <p className="login-eyebrow">Maximo SEO</p>
            <h1>Loop Engineering</h1>
          </div>
        </div>
        <p className="login-tagline">
          Sign in to the self-improving agent control room — observe, score, learn, propose, test, activate.
        </p>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <p role="alert" className="login-error">
              {error}
            </p>
          )}

          <label className="login-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@maximo-seo.com"
            />
          </label>

          <label className="login-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </label>

          <button type="submit" disabled={loading} className="login-submit">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="login-alt">
            No account? <Link to="/signup">Sign up</Link>
          </p>
          <p className="login-alt">
            <Link to="/forgot-password">Forgot password?</Link>
          </p>
        </form>

        <div className="login-badges" aria-hidden="true">
          <span>● Live Supabase</span>
          <span>Realtime</span>
          <span>Read-only surface</span>
        </div>
      </div>
    </div>
  )
}
