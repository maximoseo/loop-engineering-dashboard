import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx'
import { DashboardProvider } from './contexts/DashboardContext.tsx'
import Layout from './components/Layout.tsx'

const LoginPage = lazy(() => import('./pages/LoginPage.tsx'))
const SignupPage = lazy(() => import('./pages/SignupPage.tsx'))
const DashboardPage = lazy(() => import('./pages/DashboardPage.tsx'))
const QueuePage = lazy(() => import('./pages/QueuePage.tsx'))
const OrchestratorPage = lazy(() => import('./pages/OrchestratorPage.tsx'))
const ProposalsPage = lazy(() => import('./pages/ProposalsPage.tsx'))
const FailuresPage = lazy(() => import('./pages/FailuresPage.tsx'))
const EvalsPage = lazy(() => import('./pages/EvalsPage.tsx'))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage.tsx'))
const LessonsPage = lazy(() => import('./pages/LessonsPage.tsx'))

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15_000 } },
})

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, initializing } = useAuth()
  if (initializing) return <PageLoader />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PageLoader() {
  return (
    <div className="dashboard-content flex items-center justify-center py-20">
      <p className="text-sm text-[var(--text-dim)]">Loading…</p>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />

              <Route
                element={
                  <ProtectedRoute>
                    <DashboardProvider>
                      <Layout />
                    </DashboardProvider>
                  </ProtectedRoute>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route path="queue" element={<QueuePage />} />
                <Route path="orchestrator" element={<OrchestratorPage />} />
                <Route path="proposals" element={<ProposalsPage />} />
                <Route path="failures" element={<FailuresPage />} />
                <Route path="evals" element={<EvalsPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="lessons" element={<LessonsPage />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </QueryClientProvider>
    </AuthProvider>
  )
}
