import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { api } from './lib/api'
import { hostedAuth, signOut } from './lib/auth'
import type { Summary, Workspace } from './types/api'
import { InvestigationsPage } from './features/investigations/InvestigationsPage'
import { ReportsPage } from './features/reports/ReportsPage'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { ImportsPage } from './features/imports/ImportsPage'
import { ReconciliationPage } from './features/reconciliation/ReconciliationPage'
import { DemoImportsPage } from './features/imports/DemoImportsPage'
import { AuthGate } from './features/auth/AuthGate'
import { LandingPage } from './features/public/LandingPage'
import { WorkspaceShell } from './components/WorkspaceShell'
import { ErrorMessage } from './components/common'

function Landing() {
  const summary = useQuery({ queryKey: ['public-demo-summary'], queryFn: () => api<{ latest_run: { current_summary: Summary } | null }>('/demo/dashboard'), retry: false })
  return <LandingPage summary={summary.data?.latest_run?.current_summary} loading={summary.isLoading} error={summary.error} />
}

function WorkspaceApp({ demo = false }: { demo?: boolean }) {
  const workspace = useQuery({ queryKey: ['workspace'], queryFn: () => api<Workspace>('/workspace') })
  return <WorkspaceShell workspace={workspace.data} mode={demo ? 'demo' : hostedAuth ? 'aws' : 'local'} onSignOut={hostedAuth && !demo ? signOut : undefined}>
    <ErrorMessage error={workspace.error} />
    <Routes>
      <Route path="dashboard" element={<DashboardPage demo={demo} />} />
      <Route path="imports" element={demo ? <DemoImportsPage /> : <ImportsPage workspace={workspace.data} />} />
      <Route path="reconciliation" element={<ReconciliationPage workspace={workspace.data} demo={demo} />} />
      <Route path="investigations" element={<InvestigationsPage demo={demo} />} />
      <Route path="reports" element={<ReportsPage />} />
      <Route path="*" element={<Navigate to={demo ? '/demo/dashboard' : '/dashboard'} replace />} />
    </Routes>
  </WorkspaceShell>
}

function WorkspaceBoundary({ demo }: { demo: boolean }) {
  // Each mode gets an independent cache; operator records cannot appear in a demo view.
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 10000 } } }))
  return <QueryClientProvider client={client}>{demo ? <WorkspaceApp demo /> : <AuthGate><WorkspaceApp /></AuthGate>}</QueryClientProvider>
}

export default function App() {
  const location = useLocation()
  if (location.pathname === '/') return <Landing />
  if (location.pathname === '/demo' || location.pathname.startsWith('/demo/')) return <Routes><Route path="/demo/*" element={<WorkspaceBoundary key="demo" demo />} /></Routes>
  return <WorkspaceBoundary key="operator" demo={false} />
}
