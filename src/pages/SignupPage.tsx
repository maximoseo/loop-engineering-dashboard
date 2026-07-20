import { useAuth } from '../contexts/AuthContext.tsx'
import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'

export default function SignupPage() {
  const { signup, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await signup(email, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the account. Try again.')
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text)] flex items-center justify-center">
      <form onSubmit={handleSubmit} className="glass rounded-xl p-8 w-full max-w-sm space-y-5">
        <h1 className="text-2xl font-semibold text-center">Create account</h1>
        <p className="text-sm text-[var(--text-secondary)] text-center">Loop Engineering Dashboard</p>
        {error && (
          <p
            role="alert"
            className="text-sm text-[var(--error)] bg-[color:rgba(248,113,113,0.1)] border border-[color:rgba(248,113,113,0.35)] rounded-lg px-3 py-2"
          >
            {error}
          </p>
        )}
        <label className="block space-y-1.5">
          <span className="text-xs text-[var(--text-secondary)]">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs text-[var(--text-secondary)]">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="w-full rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-[var(--accent)] text-white py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
        <p className="text-xs text-[var(--text-secondary)] text-center">
          Already have an account?{' '}
          <Link to="/login" className="text-[var(--accent-bright)] underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  )
}
