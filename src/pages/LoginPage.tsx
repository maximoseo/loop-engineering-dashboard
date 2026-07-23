import { useAuth } from '../contexts/AuthContext.tsx'
import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { AuthLayout, AuthBrand } from '../components/AuthLayout.tsx'

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
    <AuthLayout>
      <AuthBrand
        title="Loop Engineering"
        tagline="Sign in to the self-improving agent control room — observe, score, learn, propose, test, activate."
      />

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
          <Link to="/forgot-password">Forgot password?</Link>
        </p>
      </form>

      <div className="login-badges" aria-hidden="true">
        <span>● Live Supabase</span>
        <span>Realtime</span>
        <span>Read-only surface</span>
      </div>
    </AuthLayout>
  )
}
