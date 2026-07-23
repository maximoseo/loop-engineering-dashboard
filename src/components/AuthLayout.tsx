import type { ReactNode } from 'react'

/**
 * Shared layout for all auth screens (login, forgot/reset password).
 * Renders the animated orb background + glass card shell.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="login-screen">
      <div className="login-orb login-orb-a" aria-hidden="true" />
      <div className="login-orb login-orb-b" aria-hidden="true" />
      <div className="login-card">{children}</div>
    </div>
  )
}

/** Brand header block used at the top of every auth card. */
export function AuthBrand({ title, eyebrow = 'Maximo SEO', tagline }: { title: string; eyebrow?: string; tagline?: string }) {
  return (
    <>
      <div className="login-brand">
        <span className="login-mark" aria-hidden="true">
          <span />
        </span>
        <div>
          <p className="login-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
        </div>
      </div>
      {tagline && <p className="login-tagline">{tagline}</p>}
    </>
  )
}
