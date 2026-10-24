import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, CheckCircle2, Play, Search, FileSearch, AlertTriangle, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../lib/api'
import type { Discrepancy, Match, Page, Run, Workspace } from '../../types/api'
import { Badge, displayTime, EmptyState, ErrorMessage, Loading, Money, Pagination } from '../../components/common'
import { EvidenceDialog } from '../../components/EvidenceDialog'

export function ReconciliationPage({ workspace }: { workspace?: Workspace }) {
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [tab, setTab] = useState<'matches' | 'cases'>('cases')
  const [page, setPage] = useState(1)
  const [runPage, setRunPage] = useState(1)
  const [evidence, setEvidence] = useState<Match | Discrepancy | null>(null)
  const runs = useQuery({ queryKey: ['runs', runPage], queryFn: () => api<Page<Run>>(`/runs?page=${runPage}`) })
  const runId = params.get('run') || runs.data?.items[0]?.id || ''
  const run = useQuery({ queryKey: ['run', runId], enabled: !!runId, queryFn: () => api<Run>(`/runs/${runId}`) })
  const matches = useQuery({ queryKey: ['matches', runId, page, search], enabled: !!runId && tab === 'matches' && run.data?.status === 'completed', queryFn: () => api<Page<Match>>(`/runs/${runId}/matches?page=${page}&search=${encodeURIComponent(search)}`) })
  const cases = useQuery({ queryKey: ['cases', runId, page, search, type], enabled: !!runId && tab === 'cases' && run.data?.status === 'completed', queryFn: () => api<Page<Discrepancy>>(`/discrepancies?run_id=${runId}&page=${page}&search=${encodeURIComponent(search)}&type=${encodeURIComponent(type)}`) })
  const start = useMutation({ mutationFn: () => api<Run>('/runs', { method: 'POST' }), onSuccess: result => {
    setParams({ run: result.id }); setPage(1); setRunPage(1); setSearch(''); setType('')
    queryClient.setQueryData(['run', result.id], result)
    queryClient.invalidateQueries({ queryKey: ['runs'] }); queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  } })
  const summary = run.data?.current_summary
  const currentList = tab === 'cases' ? cases : matches
  function changeRun(id: string) { setParams({ run: id }); setPage(1); setSearch(''); setType('') }

  return <>
    <div className="page-heading"><div><div className="eyebrow">FINANCIAL CONTROLS</div><h1>Reconciliation</h1><p>Compare imported records and follow every decision to its source.</p></div><button className="button primary" onClick={() => start.mutate()} disabled={start.isPending || !workspace?.input_revision}><Play size={15} />{start.isPending ? 'Reconciling...' : 'Start reconciliation'}</button></div>
    <ErrorMessage error={start.error || runs.error || run.error} />
    <div className="scope-note"><CheckCircle2 size={16} /><span>Exact order, payment, and settlement checks. Zero amount tolerance. Repeated transaction references require review.</span></div>
    {run.data?.is_stale && <div className="alert warning"><RefreshCw size={17} /><span>Inputs or engine rules have changed since this run. Start reconciliation to include them.</span></div>}
    {runs.isLoading && <Loading />}
    {!runId && !runs.isLoading && <section className="panel"><EmptyState title="No reconciliation runs yet">Confirm your source files, then start a run to calculate matches and review cases.</EmptyState><div className="empty-action"><Link to="/imports" className="button secondary">Open imports<ArrowRight size={15} /></Link></div></section>}
    {runId && <>
      <section className="panel run-selector"><div><label htmlFor="run-select">Reconciliation run</label><select id="run-select" value={runs.data?.items.some(item => item.id === runId) ? runId : ''} onChange={event => changeRun(event.target.value)}>{!runs.data?.items.some(item => item.id === runId) && <option value="">Selected run {runId.slice(0, 8)}</option>}{runs.data?.items.map(item => <option value={item.id} key={item.id}>{displayTime(item.started_at)} / {item.id.slice(0, 8)} / {item.status}</option>)}</select></div>{run.data && <div className="run-meta"><Badge value={run.data.status} /><span>Input revision {run.data.input_revision}</span><code title={run.data.snapshot_hash}>Snapshot {run.data.snapshot_hash.slice(0, 12)}</code></div>}</section>
      {runs.data && runs.data.total > 25 && <Pagination page={runPage} total={runs.data.total} onChange={setRunPage} />}
      {run.isLoading && <Loading />}
      {run.data?.status === 'running' && <div className="alert warning"><AlertTriangle size={17} />This run is incomplete. Partial results are not shown. Refresh to check its status or start a new run.</div>}
      {run.data?.status === 'failed' && <div className="alert error"><AlertTriangle size={17} />The run failed. No partial reconciliation result was accepted.</div>}
      {summary && run.data?.status === 'completed' && <>
        <div className="metrics-grid"><div className="metric"><span>Total orders</span><strong>{summary.total_orders}</strong><small>{summary.cancelled_orders} cancelled</small></div><div className="metric"><span>Eligible payments</span><strong>{summary.total_eligible_payments}</strong><small>{summary.excluded_duplicate_payment_records} duplicate-group rows excluded</small></div><div className="metric"><span>Matched order value</span><strong className="metric-money positive"><Money amounts={summary.matched_order_value} /></strong><small>{summary.matched_order_count} exact matches</small></div><div className="metric"><span>Unresolved cases</span><strong className={summary.unresolved_discrepancy_count ? 'warning-text' : ''}>{summary.unresolved_discrepancy_count}</strong><small>Evidence requires review</small></div></div>
        <div className="value-summary"><div><span>Matched settlement net</span><strong><Money amounts={summary.matched_settlement_value || {}} /></strong></div><div><span>Eligible payment value</span><strong><Money amounts={summary.total_payment_value} /></strong></div><div><span>Affected recorded value</span><strong><Money amounts={summary.unresolved_discrepancy_value} /></strong></div><p>Values stay separate by currency. Affected value groups overlapping evidence and is not a calculation of financial loss.</p></div>
        <p className="footnote">Fee configuration: {run.data.fee_configuration?.name || 'No fee rules recorded'}. {run.data.fee_configuration?.synthetic ? 'Synthetic demonstration rules. Replace them before reviewing real financial records.' : 'Only configured provider and currency rules are used.'}</p><section className="panel"><div className="result-tabs" role="tablist" aria-label="Reconciliation results"><button role="tab" aria-selected={tab === 'cases'} onClick={() => { setTab('cases'); setPage(1) }}><AlertTriangle size={16} />Review cases<span>{summary.unresolved_discrepancy_count}</span></button><button role="tab" aria-selected={tab === 'matches'} onClick={() => { setTab('matches'); setPage(1); setType('') }}><CheckCircle2 size={16} />Exact matches<span>{summary.match_count ?? summary.matched_order_count}</span></button></div>
          <div className="table-toolbar"><label className="search-field"><Search size={16} /><span className="sr-only">Search references</span><input value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} placeholder="Search reference or description" maxLength={128} /></label>{tab === 'cases' && <select aria-label="Discrepancy type" value={type} onChange={event => { setType(event.target.value); setPage(1) }}><option value="">All discrepancy types</option>{Object.keys(summary.category_counts).map(category => <option value={category} key={category}>{category.replaceAll('_', ' ')}</option>)}</select>}<span className="count-label">{currentList.data?.total ?? 0} results</span></div>
          <ErrorMessage error={currentList.error} />{currentList.isLoading && <Loading />}
          <div role="tabpanel" className="table-scroll">{tab === 'cases' ? <table><thead><tr><th>Discrepancy</th><th>Source reference</th><th>Severity</th><th>Status</th><th>Evidence</th></tr></thead><tbody>{cases.data?.items.map(item => <tr key={item.id}><td><strong className="table-title">{item.type.replaceAll('_', ' ')}</strong><span className="table-description">{item.description}</span></td><td className="reference">{item.source_records[0]?.transaction_ref || item.source_records[0]?.order_ref || 'Source records'}</td><td><Badge value={item.severity} /></td><td><Badge value={item.status} /></td><td><button className="text-link nowrap" onClick={() => setEvidence(item)}><FileSearch size={15} />View evidence</button></td></tr>)}</tbody></table> : <table><thead><tr><th>Relationship and reference</th><th>Payment reference</th><th>Provider</th><th>Decision</th><th>Evidence</th></tr></thead><tbody>{matches.data?.items.map(item => <tr key={item.id}><td className="reference"><span className="table-description">{item.kind.replaceAll('_', ' ')}</span>{item.source_records.find(record => record.record_type === 'order')?.order_ref || item.source_records.find(record => record.record_type === 'settlement')?.settlement_ref}</td><td className="reference">{item.source_records.find(record => record.record_type === 'payment')?.transaction_ref}</td><td>{item.source_records.find(record => record.record_type === 'payment')?.provider}</td><td><Badge value="matched" /></td><td><button className="text-link nowrap" onClick={() => setEvidence(item)}><FileSearch size={15} />View evidence</button></td></tr>)}</tbody></table>}</div>
          {currentList.data?.total === 0 && <EmptyState title={search || type ? 'No records match these filters' : tab === 'cases' ? 'No discrepancies in this run' : 'No exact matches in this run'}>{search || type ? 'Change the search or selected discrepancy type.' : 'Every automatic relationship requires a unique reference, equal currency, and equal amount.'}</EmptyState>}
          {currentList.data && <Pagination page={page} total={currentList.data.total} onChange={setPage} />}
        </section>
        <p className="footnote">{summary.duplicate_notification_count} extra notification rows identified. {summary.missing_payment_count} orders lack successful same-reference payment evidence. {summary.missing_settlement_evidence_count || 0} payments lack settlement evidence. Missing evidence does not prove settlement failure. Cancelled orders are excluded from matching.</p>
      </>}
    </>}
    {evidence && <EvidenceDialog item={evidence} onClose={() => setEvidence(null)} />}
  </>
}
