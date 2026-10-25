import {
  ArrowRight,
  ArrowRightLeft,
  CheckCheck,
  ClipboardList,
  FileBarChart,
  FileInput,
  FileSearch,
  FileSpreadsheet,
  ListChecks,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { moneyLines } from '../../lib/money'
import type { Summary } from '../../types/api'
import './public.css'

export type LandingPageProps = {
  summary?: Summary
  loading?: boolean
  error?: unknown
}

const workflow = [
  { icon: FileInput, title: 'Import', description: 'Bring in order, payment, and settlement exports. Review the columns and source rows before confirming.' },
  { icon: ArrowRightLeft, title: 'Match', description: 'Compare references, amounts, currencies, and statuses using explicit reconciliation rules.' },
  { icon: ClipboardList, title: 'Investigate', description: 'Inspect differences alongside the original records. Add notes and document your review decisions.' },
  { icon: FileBarChart, title: 'Report', description: 'Export reconciliation summaries and review cases, with the original results available for comparison.' },
]

export function LandingPage({ summary, loading = false, error }: LandingPageProps = {}) {
  const localOperator = import.meta.env.VITE_AUTH_MODE !== 'cognito'
  const matchedValues = summary ? moneyLines(summary.matched_order_value) : []

  return (
    <div className="public-site">
      <a className="public-skip-link" href="#public-main">Skip to content</a>
      <header className="public-header">
        <div className="public-container public-header-inner">
          <Link className="public-brand" to="/" aria-label="ReconcileOS home">
            <span className="public-brand-mark"><CheckCheck size={23} aria-hidden="true" /></span>
            <span><strong>ReconcileOS</strong><small>FINANCIAL OPERATIONS</small></span>
          </Link>
          <nav className="public-nav" aria-label="Public navigation">
            <a className="public-nav-section" href="#workflow">Workflow</a>
            <a className="public-nav-section" href="#evidence">Evidence</a>
            <Link className="public-sign-in" to="/login">Sign in</Link>
            <Link className="public-button public-button-primary" to="/demo">Try the demo<ArrowRight size={15} aria-hidden="true" /></Link>
          </nav>
        </div>
      </header>

      <main className="public-main" id="public-main" tabIndex={-1}>
        <section className="public-container public-hero" aria-labelledby="public-title">
          <div className="public-hero-copy">
            <p className="public-kicker">ORDER TO PAYMENT TO SETTLEMENT</p>
            <h1 id="public-title">Reconcile payments.<br />Review every difference.</h1>
            <p className="public-hero-description">Find missing payments, unmatched settlements, and conflicting records. Compare your exports, inspect the source evidence, and record the decisions behind your results.</p>
            <div className="public-hero-actions">
              <Link className="public-button public-button-primary" to="/demo">Try the demo<ArrowRight size={16} aria-hidden="true" /></Link>
              <Link className="public-button public-button-secondary" to="/login">Sign in to your workspace</Link>
            </div>
            <p className="public-demo-note"><ShieldCheck size={16} aria-hidden="true" /><span>Synthetic data. Read-only access. No account needed.</span></p>
          </div>

          <figure className="public-preview">
            <div className="public-preview-panel" aria-busy={loading}>
              <div className="public-preview-header">
                <div><p className="public-kicker">PUBLIC DEMO</p><h2>Reconciliation overview</h2></div>
                <span className="public-readonly"><LockKeyhole size={12} aria-hidden="true" />Read-only</span>
              </div>
              {loading ? (
                <div className="public-preview-state" role="status">
                  <LoaderCircle className="public-loading-icon" size={23} aria-hidden="true" />
                  <strong>Loading demo results</strong>
                  <p>Fetching the computed summary from the synthetic records.</p>
                </div>
              ) : error || !summary ? (
                <div className="public-preview-state" role={error ? 'alert' : 'status'}>
                  <FileSearch size={25} aria-hidden="true" />
                  <strong>Demo summary unavailable</strong>
                  <p>The reconciliation results could not be loaded. Open the demo to check its status.</p>
                  <Link className="public-text-link" to="/demo">Open the demo<ArrowRight size={14} aria-hidden="true" /></Link>
                </div>
              ) : (
                <>
                  <dl className="public-source-counts" aria-label="Synthetic source records">
                    <div><dt>Orders</dt><dd>{summary.total_orders.toLocaleString('en-GB')}</dd></div>
                    <div><dt>Payment records</dt><dd>{summary.total_payment_records.toLocaleString('en-GB')}</dd></div>
                    <div><dt>Settlement records</dt><dd>{summary.total_settlement_records.toLocaleString('en-GB')}</dd></div>
                  </dl>
                  <div className="public-ledger">
                    <div className="public-ledger-heading" aria-hidden="true"><span>Computed results</span><span>Count</span></div>
                    <dl className="public-result-list">
                      <div><dt><CheckCheck size={15} aria-hidden="true" />Matched orders</dt><dd>{summary.matched_order_count.toLocaleString('en-GB')}</dd></div>
                      <div><dt><CheckCheck size={15} aria-hidden="true" />Matched settlements</dt><dd>{summary.matched_settlement_count.toLocaleString('en-GB')}</dd></div>
                      <div className="public-review-result"><dt><FileSearch size={15} aria-hidden="true" />Unresolved cases</dt><dd>{summary.unresolved_discrepancy_count.toLocaleString('en-GB')}</dd></div>
                    </dl>
                    <dl className="public-ledger-value">
                      <div>
                        <dt>Matched order value</dt>
                        <dd>{matchedValues.length ? matchedValues.map(value => <span key={value}>{value}</span>) : <span>No recorded value</span>}</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="public-preview-footer"><span>Computed from synthetic records.<br />Currencies shown separately.</span><Link className="public-text-link" to="/demo">View records<ArrowRight size={14} aria-hidden="true" /></Link></div>
                </>
              )}
            </div>
            <figcaption>A view into the public demo, using its actual reconciliation results.</figcaption>
          </figure>
        </section>

        <div className="public-container">
          <div className="public-capabilities" aria-label="Workspace capabilities">
            <p>Built around the records you already have.</p>
            <span><FileSpreadsheet size={17} aria-hidden="true" />CSV and Excel imports</span>
            <span><FileSearch size={17} aria-hidden="true" />Source evidence</span>
            <span><FileBarChart size={17} aria-hidden="true" />CSV reports</span>
          </div>
        </div>

        <section className="public-container public-workflow" id="workflow" aria-labelledby="public-workflow-title">
          <div className="public-section-heading">
            <div><p className="public-kicker">THE WORKFLOW</p><h2 id="public-workflow-title">From source file to reviewed result.</h2></div>
            <p>Keep the evidence in view at each step, from the first import to the final report.</p>
          </div>
          <ol className="public-workflow-grid">
            {workflow.map(({ icon: Icon, title, description }, index) => (
              <li key={title}>
                <div className="public-workflow-top"><span className="public-workflow-icon"><Icon size={21} strokeWidth={1.6} aria-hidden="true" /></span><span className="public-step-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span></div>
                <h3>{title}</h3><p>{description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="public-evidence" id="evidence" aria-labelledby="public-evidence-title">
          <div className="public-container public-evidence-grid">
            <div className="public-evidence-intro">
              <p className="public-kicker">EVIDENCE AND ACCESS</p>
              <h2 id="public-evidence-title">A result is only useful when you can explain it.</h2>
              <p>See which records support a match, why a difference was flagged, and how a review decision was made.</p>
              <div className="public-evidence-boundary"><ShieldCheck size={19} aria-hidden="true" /><p>ReconcileOS compares records. It does not access bank accounts or move money.</p></div>
            </div>
            <div className="public-evidence-list">
              <article><FileSearch size={21} strokeWidth={1.6} aria-hidden="true" /><div><h3>Follow the source</h3><p>Original source rows and import choices stay linked to the results. Inspect the supporting records and the rule behind each match or case.</p></div></article>
              <article><ListChecks size={21} strokeWidth={1.6} aria-hidden="true" /><div><h3>Keep a record of the review</h3><p>Explicit matching rules identify candidates. Review notes, reasons, and case decisions are recorded in the history.</p></div></article>
              <article><LockKeyhole size={21} strokeWidth={1.6} aria-hidden="true" /><div><h3>Separate exploration from operations</h3><p>The public demo is read-only and uses synthetic records. Approved operators sign in to import files and record workspace decisions.</p></div></article>
            </div>
          </div>
        </section>

        <section className="public-container public-demo-section" aria-labelledby="public-demo-title">
          <div className="public-demo-invitation">
            <div><p className="public-kicker">TAKE A CLOSER LOOK</p><h2 id="public-demo-title">Inspect the records yourself.</h2><p>Explore computed results and supporting synthetic records. No account or credentials required.</p></div>
            <Link className="public-button public-button-primary" to="/demo">Try the demo<ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
        </section>
      </main>

      <footer className="public-footer">
        <div className="public-container public-footer-inner"><div><Link to="/" className="public-footer-brand">ReconcileOS</Link><span>Orders. Payments. Settlements.</span></div><nav aria-label="Footer navigation"><Link to="/demo">Public demo</Link><Link to="/login">Sign in</Link>{localOperator && <Link to="/dashboard">Local operator workspace<ArrowRight size={13} aria-hidden="true" /></Link>}</nav></div>
      </footer>
    </div>
  )
}
