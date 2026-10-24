import { useQuery } from '@tanstack/react-query'
import { ArrowRightLeft, CheckCheck, Circle, FileInput, ShieldCheck, LayoutDashboard, ClipboardList, FileBarChart } from 'lucide-react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { api } from './lib/api'
import { hostedAuth, signOut } from './lib/auth'
import type { Workspace } from './types/api'
import { InvestigationsPage } from './features/investigations/InvestigationsPage'
import { ReportsPage } from './features/reports/ReportsPage'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { ImportsPage } from './features/imports/ImportsPage'
import { ReconciliationPage } from './features/reconciliation/ReconciliationPage'
import { ErrorMessage } from './components/common'

export default function App() {
  const workspace = useQuery({ queryKey: ['workspace'], queryFn: () => api<Workspace>('/workspace') })
  const location = useLocation()
  const section = location.pathname.startsWith('/reconciliation') ? 'Reconciliation' : location.pathname.startsWith('/imports') ? 'Imports' : location.pathname.startsWith('/investigations') ? 'Investigations' : location.pathname.startsWith('/reports') ? 'Reports' : 'Dashboard'
  return <div className="app-shell">
    <aside className="sidebar"><LinkBrand /><div className="nav-label">WORKSPACE</div><nav aria-label="Main navigation"><NavLink to="/dashboard"><LayoutDashboard size={18} />Dashboard</NavLink><NavLink to="/imports"><FileInput size={18} />Imports</NavLink><NavLink to="/reconciliation"><ArrowRightLeft size={18} />Reconciliation</NavLink><NavLink to="/investigations"><ClipboardList size={18} />Investigations</NavLink><NavLink to="/reports"><FileBarChart size={18} />Reports</NavLink></nav><div className="sidebar-bottom"><div><Circle size={9} className="local-dot" />{hostedAuth ? 'Hosted workspace' : 'Local workspace'}</div><p>{hostedAuth ? <>Approved operators<br />Records stored in AWS</> : <>Single operator<br />Records stored on this device</>}</p></div></aside>
    <div className="main-area"><header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>{section}</strong></div><div className="operator"><ShieldCheck size={15} /><span>{hostedAuth ? 'Workspace operator' : workspace.data?.operator || 'Local operator'}</span>{hostedAuth && <button className="text-link" onClick={signOut}>Sign out</button>}</div></header><main>
      <ErrorMessage error={workspace.error} />
      <Routes><Route path="/investigations" element={<InvestigationsPage />} /><Route path="/reports" element={<ReportsPage />} /><Route path="/dashboard" element={<DashboardPage />} /><Route path="/imports" element={<ImportsPage workspace={workspace.data} />} /><Route path="/reconciliation" element={<ReconciliationPage workspace={workspace.data} />} /><Route path="*" element={<Navigate to="/dashboard" replace />} /></Routes>
    </main><footer className="app-footer"><span>ReconcileOS</span><span>{hostedAuth ? 'AWS mode' : 'Local mode'} · {workspace.data?.rule_scope || 'Orders, payments, and settlements'}</span></footer></div>
  </div>
}

function LinkBrand() {
  return <NavLink className="brand" to="/imports"><span className="brand-mark"><CheckCheck size={22} /></span><span><strong>ReconcileOS</strong><small>FINANCIAL OPERATIONS</small></span></NavLink>
}
