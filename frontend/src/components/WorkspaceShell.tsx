import { useState, type ReactNode } from 'react'
import {
  ArrowRight, ArrowRightLeft, Building2, CheckCheck, ChevronRight, ClipboardList,
  Database, FileBarChart, FileInput, LayoutDashboard, LockKeyhole, LogOut, Menu,
  ShieldCheck, X,
} from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import type { Workspace } from '../types/api'
import '../workspace.css'

type WorkspaceShellProps = {
  children: ReactNode
  workspace?: Workspace
  mode: 'demo' | 'aws' | 'local'
  onSignOut?: () => void
}

const sections = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, context: 'Operational overview' },
  { path: '/imports', label: 'Imports', icon: FileInput, context: 'Source records' },
  { path: '/reconciliation', label: 'Reconciliation', icon: ArrowRightLeft, context: 'Matching and exceptions' },
  { path: '/investigations', label: 'Investigations', icon: ClipboardList, context: 'Evidence and review' },
  { path: '/reports', label: 'Reports', icon: FileBarChart, context: 'Recorded results' },
]

export function WorkspaceShell({ children, workspace, mode, onSignOut }: WorkspaceShellProps) {
  const [navigationOpen, setNavigationOpen] = useState(false)
  const { pathname } = useLocation()
  const demo = mode === 'demo'
  const prefix = demo ? '/demo' : ''
  const section = sections.find(item => pathname === `${prefix}${item.path}` || pathname.startsWith(`${prefix}${item.path}/`)) || sections[0]
  const SectionIcon = section.icon
  const workspaceName = workspace?.name || (demo ? 'Sample workspace' : 'Operations workspace')
  const modeLabel = demo ? 'Read-only demo' : mode === 'aws' ? 'AWS workspace' : 'Local workspace'

  return <div className={`app-shell workspace-v2${navigationOpen ? ' navigation-open' : ''}`}>
    <a className="workspace-skip-link" href="#workspace-content">Skip to workspace content</a>
    <aside className="sidebar workspace-sidebar" aria-label="Workspace sidebar">
      <NavLink className="brand workspace-brand" to={`${prefix}/dashboard`} onClick={() => setNavigationOpen(false)} aria-label="ReconcileOS dashboard">
        <span className="brand-mark"><CheckCheck size={24} strokeWidth={2} aria-hidden="true" /></span>
        <span><strong>ReconcileOS</strong><small>Financial operations</small></span>
      </NavLink>
      <button className="workspace-menu-button" type="button" aria-expanded={navigationOpen} aria-controls="workspace-navigation" onClick={() => setNavigationOpen(open => !open)}>
        {navigationOpen ? <X size={19} aria-hidden="true" /> : <Menu size={19} aria-hidden="true" />}
        {navigationOpen ? 'Close menu' : 'Menu'}
      </button>
      <div className="workspace-identity">
        <Building2 size={18} aria-hidden="true" />
        <div><strong title={workspaceName}>{workspaceName}</strong><small>{modeLabel}</small></div>
      </div>
      <nav id="workspace-navigation" aria-label="Main navigation">
        {sections.map(({ path, label, icon: Icon }) => <NavLink key={path} to={`${prefix}${path}`} onClick={() => setNavigationOpen(false)}>
          <Icon size={18} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span><ChevronRight size={14} className="workspace-nav-chevron" aria-hidden="true" />
        </NavLink>)}
      </nav>
      <div className="sidebar-bottom workspace-sidebar-bottom">
        <span className="workspace-mode"><Database size={13} aria-hidden="true" />{demo ? 'Separate sample database' : mode === 'aws' ? 'AWS mode' : 'Local mode'}</span>
      </div>
    </aside>

    <div className="main-area workspace-main-area">
      <header className="topbar workspace-topbar">
        <div className="workspace-section"><SectionIcon size={18} aria-hidden="true" /><span>Workspace</span><ChevronRight size={14} aria-hidden="true" /><strong>{section.label}</strong><span className="workspace-section-context">{section.context}</span></div>
        <div className="workspace-account-actions">
          {demo ? <><Link className="text-link workspace-exit" to="/"><LogOut size={15} aria-hidden="true" />Exit demo</Link><Link className="button secondary compact" to="/login">Sign in<ArrowRight size={14} aria-hidden="true" /></Link></> : <>
            <span className="workspace-operator"><ShieldCheck size={15} aria-hidden="true" />{mode === 'aws' ? 'Workspace operator' : workspace?.operator || modeLabel}</span>
            {onSignOut && <button type="button" className="text-link" onClick={onSignOut}><LogOut size={15} aria-hidden="true" />Sign out</button>}
          </>}
        </div>
      </header>

      {demo && <div className="workspace-status-strip workspace-demo-strip">
        <div className="workspace-status-copy">
          {demo ? <LockKeyhole size={16} aria-hidden="true" /> : <Database size={16} aria-hidden="true" />}
          <strong>Synthetic read-only sample</strong>
          <span>No account needed. Source records stay unchanged.</span>
        </div>
      </div>}

      <main id="workspace-content" className="workspace-content" tabIndex={-1}>
        {demo && <details className="demo-guide"><summary>Take a two-minute tour</summary><ol><li><Link to="/demo/reconciliation">View reconciliation results</Link></li><li><Link to="/demo/investigations?type=partial_payment">Inspect a payment difference and its evidence</Link></li>{workspace?.demo?.ai_case_id && <li><Link to={`/demo/investigations?case=${workspace.demo.ai_case_id}`}>Read a saved AI investigation</Link></li>}<li><Link to="/demo/reports">Explore and export the report</Link></li></ol><p>Review decisions and new AI requests are available only in an operator workspace.</p></details>}
        {children}
      </main>
      <footer className="app-footer workspace-footer"><span><CheckCheck size={14} aria-hidden="true" />ReconcileOS <span>/ Financial operations</span></span><span>{demo ? 'Synthetic records / Read-only access' : workspace?.rule_scope || 'Orders, payments, and settlements'}</span></footer>
    </div>
  </div>
}
