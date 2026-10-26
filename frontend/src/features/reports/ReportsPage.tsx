import { useMutation, useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { api, downloadCsv } from '../../lib/api'
import type { Page, Run, Summary } from '../../types/api'
import { displayTime, EmptyState, ErrorMessage, Loading, Money } from '../../components/common'
import { casePriority, caseTitle } from '../investigations/casePresentation'

export function ReportsPage() {
  const [params, setParams] = useSearchParams()
  const runs = useQuery({ queryKey: ['runs', 'reports'], queryFn: () => api<Page<Run>>('/runs?page_size=100') })
  const id = params.get('run') || runs.data?.items.find(run => run.status === 'completed')?.id || ''
  const download = useMutation({ mutationFn: (kind: 'summary' | 'discrepancies') => downloadCsv(`/reports/${id}/export?kind=${kind}`, `reconcileos-${id}-${kind}.csv`) })
  const report = useQuery({ queryKey: ['report', id], enabled: !!id, queryFn: () => api<{ run_id: string; snapshot_hash: string; current_summary: Summary; original_summary: Summary; metric_definitions: Record<string, string> }>(`/reports/${id}`) })
  const summary = report.data?.current_summary
  const categories = Object.entries(summary?.category_counts || {}).sort(([a], [b]) => casePriority(a) - casePriority(b))
  return <>
    <div className="page-heading"><div><h1>Reports</h1><p>Current review results, with the original automatic summary preserved.</p></div></div><ErrorMessage error={runs.error || report.error} />
    <section className="run-selector"><label>Report run<select value={id} onChange={event => setParams({ run: event.target.value })}><option value="">Choose a completed run</option>{id && !runs.data?.items.some(run => run.id === id) && <option value={id}>Selected run {id.slice(0, 8)}</option>}{runs.data?.items.filter(run => run.status === 'completed').map(run => <option key={run.id} value={run.id}>{displayTime(run.started_at)} / {run.id.slice(0, 8)}</option>)}</select></label>{summary && <div className="button-group"><button className="button primary" disabled={download.isPending} onClick={() => download.mutate('summary')}><Download size={16} />Export summary CSV</button><button className="button secondary" disabled={download.isPending} onClick={() => download.mutate('discrepancies')}><Download size={16} />Export cases CSV</button></div>}</section><ErrorMessage error={download.error} />
    {download.isPending && <p role="status">Preparing CSV...</p>}
    {(report.isLoading || runs.isLoading) && <Loading />}{!id && !runs.isLoading && <EmptyState title="No completed run to report">Complete reconciliation before exporting results.</EmptyState>}
    {summary && <>
      <div className="dashboard-results report-results"><article><h2>Matched order value</h2><strong className="positive"><Money amounts={summary.matched_order_value} /></strong><p>{summary.matched_order_count} accepted relationships</p></article><article><h2>Matched settlement net</h2><strong className="positive"><Money amounts={summary.matched_settlement_value} /></strong><p>{summary.matched_settlement_count} accepted relationships</p></article><article><h2>Unresolved cases</h2><strong>{summary.unresolved_discrepancy_count}</strong><p>{report.data?.original_summary.unresolved_discrepancy_count} in the original automatic result</p></article></div>
      <div className="report-body"><section className="panel"><div className="panel-heading"><h2>Discrepancy breakdown</h2></div><div className="table-scroll" role="region" aria-label="Report discrepancy breakdown" tabIndex={0}><table><thead><tr><th scope="col">Category</th><th scope="col" className="number">Unresolved cases</th></tr></thead><tbody>{categories.map(([category, count]) => <tr key={category}><td>{caseTitle(category)}</td><td className="number">{count}</td></tr>)}</tbody></table></div>{!categories.length && <EmptyState title="No unresolved cases">Every case has a recorded disposition.</EmptyState>}</section>
      <aside className="report-context"><h2>Affected recorded value</h2><strong><Money amounts={summary.unresolved_discrepancy_value} /></strong><p>Connected unresolved evidence, counted once per currency. This is not confirmed financial loss.</p><p className="footnote">Categories can share records. Order value and settlement net describe separate relationships.</p><p className="footnote">Snapshot {report.data?.snapshot_hash.slice(0, 12)}</p></aside></div>
      <details className="secondary-details"><summary>Understanding these figures</summary><dl className="metric-definitions">{Object.entries(report.data?.metric_definitions || {}).map(([metric, definition]) => <div key={metric}><dt>{metric.replaceAll('_', ' ')}</dt><dd>{definition}</dd></div>)}</dl><p className="footnote">Summary CSV includes original and current results. Case CSV includes all cases with their current review status. Monetary values include currency, exact decimal amounts, and integer minor units. Formula-like cells are neutralized.</p></details>
    </>}
  </>
}
