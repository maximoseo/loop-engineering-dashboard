import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.tsx'

const sentryDsn = import.meta.env.VITE_SENTRY_DSN
if (import.meta.env.PROD && sentryDsn && !sentryDsn.includes('placeholder')) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.VITE_VERCEL_ENV || 'production',
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<div>Something went wrong. Please refresh the page.</div>}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
