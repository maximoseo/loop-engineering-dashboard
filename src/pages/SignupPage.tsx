import { useAuth } from '../contexts/AuthContext.tsx'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

export default function SignupPage() {
  const { signup, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await signup(email, password)
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text)] flex items-center justify-center">
      <form onSubmit={handleSubmit} className="glass rounded-xl p-8 w-full max-w-sm space-y-5">
        <h1 className="text-2xl font-semibold text-center">Create account</h1>
        <p className="text-sm text-[var(--text-dim)] text-center">Loop Engineering Dashboard</p>
        <label className="block space-y-1.5">
          <span className="text-xs text-[var(--text-dim)]">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs text-[var(--text-dim)]">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-[var(--accent-bright)] text-white py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </div>
  )
}
