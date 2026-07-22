import { useState, useEffect, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.ts'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [noSession, setNoSession] = useState(false)

  useEffect(() => {
    // Check for recovery session (established from URL hash by Supabase)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true)
      } else {
        // Listen for the async recovery token exchange
        const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'PASSWORD_RECOVERY' && session) {
            setReady(true)
          }
        })
        // Fallback timeout
        const t = setTimeout(() => {
          supabase.auth.getSession().then(({ data }) => {
            if (!data.session) setNoSession(true)
          })
        }, 4000)
        return () => {
          sub.subscription.unsubscribe()
          clearTimeout(t)
        }
      }
    })
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError(updateError.message)
    } else {
      setMessage('Password updated successfully! Redirecting…')
      setTimeout(() => navigate('/'), 1500)
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

        {noSession ? (
          <div className="login-form">
            <p className="login-tagline" style={{ color: 'var(--yellow, #f59e0b)' }}>
              This reset link is invalid or has expired. Please request a new one.
            </p>
            <p className="login-alt">
              <Link to="/forgot-password">Request new link</Link>
            </p>
            <p className="login-alt">
              <Link to="/login">← Back to sign in</Link>
            </p>
          </div>
        ) : !ready ? (
          <div className="login-form">
            <p className="login-tagline">Verifying reset link…</p>
          </div>
        ) : (
          <>
            <p className="login-tagline">
              Choose a strong new password (at least 8 characters).
            </p>

            <form onSubmit={handleSubmit} className="login-form">
              {error && (
                <p role="alert" className="login-error">
                  {error}
                </p>
              )}

              {message && (
                <p className="login-tagline" style={{ color: 'var(--green, #10b981)' }}>
                  {message}
                </p>
              )}

              <label className="login-field">
                <span>New password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                />
              </label>

              <label className="login-field">
                <span>Confirm password</span>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                />
              </label>

              <button type="submit" disabled={loading || !password || !confirm} className="login-submit">
                {loading ? 'Updating…' : 'Update password'}
              </button>

              <p className="login-alt">
                <Link to="/login">← Back to sign in</Link>
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
