import { useQuery } from '@tanstack/react-query'
import { ArrowRight, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Batch, Run } from '../../types/api'
import { api } from '../../lib/api'
import { displayTime, EmptyState, ErrorMessage, Loading, Money } from '../../components/common'
import { casePriority, caseTitle } from '../investigations/casePresentation'

type DashboardData = { latest_run: Run | null; recent_runs: Run[]; recent_imports: Batch[] }
const number = (value: number) => value.toLocaleString('en-GB')

export function DashboardPage({ demo = false }: { demo?: boolean }) {
  const prefix = demo ? '/demo' : ''
  const result = useQuery({ queryKey: ['dashboard'], queryFn: () => api<DashboardData>('/dashboard') })
  const run = result.data?.latest_run
  const summary = run?.status === 'completed' ? run.current_summary : undefined
  const categories = Object.entries(summary?.category_counts || {}).filter(([, count]) => count > 0).sort(([a], [b]) => casePriority(a) - casePriority(b))
  const runQuery = run ? `?run=${encodeURIComponent(run.id)}` : ''
  const next = !run ? { label: 'Import records', path: '/imports' } : run.is_stale && !demo ? { label: 'Update reconciliation', path: '/reconciliation' } : summary?.unresolved_discrepancy_count ? { label: 'Review unresolved cases', path: `/investigations${runQuery}` } : { label: 'View report', path: `/reports${runQuery}` }
  return <div className="workspace-dashboard">
    <div className="page-heading"><div><h1>Dashboard</h1><p>{demo ? 'A completed reconciliation of synthetic business records.' : 'Your latest reconciliation and the work still to review.'}</p></div><Link className="button primary" to={`${prefix}${next.path}`}>{next.label}<ArrowRight size={16} /></Link></div>
    <ErrorMessage error={result.error} />{result.isLoading && <Loading />}
    {result.data && !run && <EmptyState title="Start with your source files">Import orders, payments, and settlements. Your first completed reconciliation will appear here.</EmptyState>}
    {summary && run && <>
      <div className="dashboard-snapshot"><span>Latest completed run / <time dateTime={run.completed_at || run.started_at}>{displayTime(run.completed_at || run.started_at)}</time></span><Link className="text-link" to={`${prefix}/reconciliation${runQuery}`}>Run {run.id.slice(0, 8)}<ArrowRight size={14} /></Link></div>
      {run.is_stale && <div className="alert warning"><RefreshCw size={17} /><span>New inputs or rules are available. This summary still describes the recorded snapshot.</span></div>}
      <div className="dashboard-results">
        <article><h2>Matched order value</h2><strong className="positive"><Money amounts={summary.matched_order_value} /></strong><p>{number(summary.matched_order_count)} accepted order relationships</p></article>
        <article><h2>Matched settlement net</h2><strong className="positive"><Money amounts={summary.matched_settlement_value} /></strong><p>{number(summary.matched_settlement_count)} accepted settlement relationships</p></article>
        <article className="attention-result"><h2>Unresolved cases</h2><strong className="warning-text">{number(summary.unresolved_discrepancy_count)}</strong><p>{number(summary.missing_settlement_evidence_count)} concern missing settlement evidence</p></article>
      </div>
      <section className="source-coverage" aria-label="Source records in this snapshot"><h2>Records reconciled</h2><dl><div><dt>Orders</dt><dd>{number(summary.total_orders)}</dd></div><div><dt>Payments</dt><dd>{number(summary.total_payment_records)}</dd></div><div><dt>Settlements</dt><dd>{number(summary.total_settlement_records)}</dd></div></dl><Link className="text-link" to={`${prefix}/imports`}>View source files<ArrowRight size={14} /></Link></section>
      <div className="dashboard-work">
        <section className="priority-categories"><div className="section-heading"><h2>Needs attention</h2><Link className="text-link" to={`${prefix}/investigations${runQuery}`}>All cases<ArrowRight size={14} /></Link></div>
          {categories.length ? <ul>{categories.slice(0, 6).map(([category, count]) => <li key={category}><Link to={`${prefix}/investigations${runQuery}&type=${encodeURIComponent(category)}`}><span>{caseTitle(category)}</span><strong>{number(count)}</strong><ArrowRight size={15} /></Link></li>)}</ul> : <p className="muted">No unresolved cases in this run.</p>}
          <p className="footnote">Cases can share source records. Missing evidence does not prove a failed payment or settlement.</p>
        </section>
        <aside className="dashboard-next"><h2>{run.is_stale && !demo ? 'Include the latest records' : summary.unresolved_discrepancy_count ? 'Start with the evidence' : 'Share the reviewed results'}</h2><p>{run.is_stale && !demo ? 'Create a new reconciliation snapshot before continuing your review.' : summary.unresolved_discrepancy_count ? 'Open a case to compare the records, understand the difference, and decide what to check next.' : 'Export the current results together with the original automatic summary.'}</p><Link className="button primary" to={`${prefix}${next.path}`}>{next.label}<ArrowRight size={16} /></Link><Link className="text-link" to={`${prefix}/reports${runQuery}`}>Open reconciliation report</Link></aside>
      </div>
      <details className="secondary-details"><summary>Additional financial context</summary><dl className="context-values"><div><dt>Eligible payment value</dt><dd><Money amounts={summary.total_payment_value} /></dd></div><div><dt>Affected recorded value</dt><dd><Money amounts={summary.unresolved_discrepancy_value} /></dd></div></dl><p className="footnote">Currencies stay separate. Affected value groups connected unresolved evidence once; it is not financial loss. Order value and settlement net describe different relationships and must not be added together.</p></details>
    </>}
    {!!result.data?.recent_imports.length && <details className="secondary-details"><summary>Recent imports</summary><ul className="recent-imports">{result.data.recent_imports.slice(0, 3).map(batch => <li key={batch.id}><Link className="text-link" to={`${prefix}/imports?batch=${batch.id}`}>{batch.filename}</Link><span>{batch.total_rows} rows / {batch.status} / {displayTime(batch.created_at)}</span></li>)}</ul></details>}
  </div>
}
