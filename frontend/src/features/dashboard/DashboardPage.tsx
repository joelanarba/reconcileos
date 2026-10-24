import { useQuery } from '@tanstack/react-query'
import { ArrowRight, FileInput } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Batch, Run } from '../../types/api'
import { api } from '../../lib/api'
import { Badge, displayTime, EmptyState, ErrorMessage, Loading, Money } from '../../components/common'

export function DashboardPage() {
  const result = useQuery({ queryKey: ['dashboard'], queryFn: () => api<{ latest_run: Run | null; recent_runs: Run[]; recent_imports: Batch[] }>('/dashboard') })
  const run = result.data?.latest_run
  const summary = run?.current_summary
  return <>
    <div className="page-heading"><div><div className="eyebrow">WORKSPACE OVERVIEW</div><h1>Dashboard</h1><p>Recorded evidence, accepted relationships, and outstanding review work.</p></div><Link className="button primary" to="/imports"><FileInput size={16} />Import records</Link></div>
    <ErrorMessage error={result.error} />{result.isLoading && <Loading />}
    {!run && !result.isLoading && <section className="panel"><EmptyState title="Build your first reconciliation">Import order, payment, or settlement records, then start reconciliation. Summary values appear after a completed run.</EmptyState><div className="empty-action"><Link to="/reconciliation" className="button secondary">Open reconciliation<ArrowRight size={15} /></Link></div></section>}
    {summary && run && <>
      <div className="scope-note">Latest completed run {run.id.slice(0, 8)} / {displayTime(run.started_at)}{run.is_stale ? ' / New inputs or rules require another run' : ''}</div>
      <div className="metrics-grid">
        <div className="metric"><span>Matched order value</span><strong className="metric-money positive"><Money amounts={summary.matched_order_value} /></strong><small>{summary.matched_order_count} accepted order relationships</small></div>
        <div className="metric"><span>Matched settlement net</span><strong className="metric-money positive"><Money amounts={summary.matched_settlement_value || {}} /></strong><small>{summary.matched_settlement_count || 0} accepted settlement relationships</small></div>
        <div className="metric"><span>Unresolved cases</span><strong className="warning-text">{summary.unresolved_discrepancy_count}</strong><small>Overlapping cases are not separate losses</small></div>
        <div className="metric"><span>Missing settlement evidence</span><strong>{summary.missing_settlement_evidence_count || 0}</strong><small>Absence of a record does not prove failure</small></div>
      </div>
      <div className="value-summary"><div><span>Affected recorded value</span><strong><Money amounts={summary.unresolved_discrepancy_value} /></strong></div><div><span>Eligible payment value</span><strong><Money amounts={summary.total_payment_value} /></strong></div><p>Separate totals by currency. Affected value counts connected evidence once and represents review exposure, not financial loss.</p></div>
      <section className="panel"><div className="panel-heading"><h2>Outstanding categories</h2><Link className="text-link" to={`/reconciliation?run=${run.id}`}>Open results<ArrowRight size={14} /></Link></div><div className="table-scroll"><table><thead><tr><th>Case category</th><th>Unresolved cases</th></tr></thead><tbody>{Object.entries(summary.category_counts).map(([category, count]) => <tr key={category}><td>{category.replaceAll('_', ' ')}</td><td>{count}</td></tr>)}</tbody></table></div>{!Object.keys(summary.category_counts).length && <EmptyState title="No outstanding cases">All records in this snapshot satisfy their applicable rules or have documented review decisions.</EmptyState>}</section>
    </>}
    <section className="panel"><div className="panel-heading"><h2>Recent reconciliation runs</h2></div><div className="table-scroll"><table><thead><tr><th>Started</th><th>Run</th><th>Status</th><th>Review cases</th><th>Results</th></tr></thead><tbody>{result.data?.recent_runs.map(item => <tr key={item.id}><td>{displayTime(item.started_at)}</td><td><code>{item.id.slice(0, 8)}</code></td><td><Badge value={item.status} /></td><td>{item.current_summary.unresolved_discrepancy_count ?? 'Unavailable'}</td><td><Link className="text-link" to={`/reconciliation?run=${item.id}`}>Open run</Link></td></tr>)}</tbody></table></div></section>
    <section className="panel"><div className="panel-heading"><h2>Import activity</h2></div><div className="table-scroll"><table><thead><tr><th>File</th><th>Record type</th><th>Status</th><th>Rows</th><th>Created</th></tr></thead><tbody>{result.data?.recent_imports.map(batch => <tr key={batch.id}><td><Link className="text-link" to={`/imports?batch=${batch.id}`}>{batch.filename}</Link></td><td>{batch.source_type}</td><td><Badge value={batch.status} /></td><td>{batch.total_rows}</td><td>{displayTime(batch.created_at)}</td></tr>)}</tbody></table></div></section>
  </>
}
