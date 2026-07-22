import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.ts'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (resetError) {
      setError(resetError.message)
    } else {
      setSent(true)
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

        {sent ? (
          <div className="login-form">
            <p className="login-tagline" style={{ color: 'var(--green, #10b981)' }}>
              If an account exists for <strong>{email}</strong>, a password reset link has been sent. Check your inbox.
            </p>
            <p className="login-alt">
              <Link to="/login">← Back to sign in</Link>
            </p>
          </div>
        ) : (
          <>
            <p className="login-tagline">
              Enter your email and we&apos;ll send you a link to reset your password.
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

              <button type="submit" disabled={loading} className="login-submit">
                {loading ? 'Sending…' : 'Send reset link'}
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
