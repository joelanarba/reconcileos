import { useMutation, useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { api, downloadCsv } from '../../lib/api'
import type { Page, Run, Summary } from '../../types/api'
import { displayTime, EmptyState, ErrorMessage, Loading, Money } from '../../components/common'

export function ReportsPage() {
  const [params, setParams] = useSearchParams()
  const runs = useQuery({ queryKey: ['runs', 'reports'], queryFn: () => api<Page<Run>>('/runs?page_size=100') })
  const id = params.get('run') || runs.data?.items.find(run => run.status === 'completed')?.id || ''
  const download = useMutation({ mutationFn: (kind: 'summary' | 'discrepancies') => downloadCsv(`/reports/${id}/export?kind=${kind}`, `reconcileos-${id}-${kind}.csv`) })
  const report = useQuery({ queryKey: ['report', id], enabled: !!id, queryFn: () => api<{ run_id: string; snapshot_hash: string; current_summary: Summary; original_summary: Summary; metric_definitions: Record<string, string> }>(`/reports/${id}`) })
  const summary = report.data?.current_summary
  return <>
    <div className="page-heading"><div><div className="eyebrow">RECORDED RESULTS</div><h1>Reports</h1><p>Export current review results alongside the original automatic summary.</p></div></div><ErrorMessage error={runs.error || report.error} />
    <section className="panel run-selector"><label>Report run<select value={id} onChange={event => setParams({ run: event.target.value })}><option value="">Choose a completed run</option>{id && !runs.data?.items.some(run => run.id === id) && <option value={id}>Selected run {id.slice(0, 8)}</option>}{runs.data?.items.filter(run => run.status === 'completed').map(run => <option key={run.id} value={run.id}>{displayTime(run.started_at)} / {run.id.slice(0, 8)}</option>)}</select></label>{id && <div className="button-group"><button className="button secondary" disabled={download.isPending} onClick={() => download.mutate('summary')}><Download size={15} />Export summary CSV</button><button className="button secondary" disabled={download.isPending} onClick={() => download.mutate('discrepancies')}><Download size={15} />Export cases CSV</button></div>}</section><ErrorMessage error={download.error} />
    {report.isLoading && <Loading />}{!id && !runs.isLoading && <EmptyState title="No completed run to report">Complete reconciliation before exporting results.</EmptyState>}
    {summary && <><div className="metrics-grid"><div className="metric"><span>Matched order value</span><strong className="metric-money"><Money amounts={summary.matched_order_value} /></strong></div><div className="metric"><span>Matched settlement net</span><strong className="metric-money"><Money amounts={summary.matched_settlement_value || {}} /></strong></div><div className="metric"><span>Unresolved cases</span><strong>{summary.unresolved_discrepancy_count}</strong><small>Original automatic count: {report.data?.original_summary.unresolved_discrepancy_count}</small></div><div className="metric"><span>Affected recorded value</span><strong className="metric-money"><Money amounts={summary.unresolved_discrepancy_value} /></strong><small>Not financial loss</small></div></div>
      <section className="panel"><div className="panel-heading"><h2>Current discrepancy breakdown</h2><code>Snapshot {report.data?.snapshot_hash.slice(0, 12)}</code></div><div className="table-scroll"><table><thead><tr><th>Category</th><th>Unresolved cases</th></tr></thead><tbody>{Object.entries(summary.category_counts).map(([category, count]) => <tr key={category}><td>{category.replaceAll('_', ' ')}</td><td>{count}</td></tr>)}</tbody></table></div></section>
      <section className="panel"><div className="panel-heading"><h2>How to read these metrics</h2></div><dl className="metric-definitions">{Object.entries(report.data?.metric_definitions || {}).map(([metric, definition]) => <div key={metric}><dt>{metric.replaceAll('_', ' ')}</dt><dd>{definition}</dd></div>)}</dl><p className="footnote case-content">CSV monetary values include explicit currency, exact decimal amounts, and integer minor units. Formula-like cells are neutralized. Case categories overlap.</p></section></>}
  </>
}
