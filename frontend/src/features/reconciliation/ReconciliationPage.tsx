import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, CheckCircle2, Play, Search, FileSearch, AlertTriangle, RefreshCw } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../lib/api'
import type { Discrepancy, Match, Page, Run, Workspace } from '../../types/api'
import { Badge, displayTime, EmptyState, ErrorMessage, Loading, Money, Pagination } from '../../components/common'
import { EvidenceDialog } from '../../components/EvidenceDialog'
import { casePriority, caseTitle, presentCase } from '../investigations/casePresentation'

type ResultTab = 'cases' | 'matches' | 'summary'
const tabs: ResultTab[] = ['cases', 'matches', 'summary']

export function ReconciliationPage({ workspace, demo = false }: { workspace?: Workspace; demo?: boolean }) {
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('unresolved')
  const [tab, setTab] = useState<ResultTab>('cases')
  const [page, setPage] = useState(1)
  const [runPage, setRunPage] = useState(1)
  const [evidence, setEvidence] = useState<Match | Discrepancy | null>(null)
  const prefix = demo ? '/demo' : ''
  const runs = useQuery({ queryKey: ['runs', runPage], queryFn: () => api<Page<Run>>(`/runs?page=${runPage}`) })
  const runId = params.get('run') || runs.data?.items[0]?.id || ''
  const run = useQuery({ queryKey: ['run', runId], enabled: !!runId, queryFn: () => api<Run>(`/runs/${runId}`) })
  const matches = useQuery({ queryKey: ['matches', runId, page, search], enabled: !!runId && tab === 'matches' && run.data?.status === 'completed', queryFn: () => api<Page<Match>>(`/runs/${runId}/matches?page=${page}&search=${encodeURIComponent(search)}`) })
  const cases = useQuery({ queryKey: ['cases', runId, page, search, type, status], enabled: !!runId && tab === 'cases' && run.data?.status === 'completed', queryFn: () => api<Page<Discrepancy>>(`/discrepancies?run_id=${runId}&page=${page}&search=${encodeURIComponent(search)}&type=${encodeURIComponent(type)}&status=${encodeURIComponent(status)}`) })
  const start = useMutation({ mutationFn: () => api<Run>('/runs', { method: 'POST' }), onSuccess: result => {
    setParams({ run: result.id }); setPage(1); setRunPage(1); setSearch(''); setType(''); setStatus('unresolved'); setTab('cases')
    queryClient.setQueryData(['run', result.id], result)
    queryClient.invalidateQueries({ queryKey: ['runs'] }); queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  } })
  const summary = run.data?.current_summary
  const currentList = tab === 'cases' ? cases : matches
  function changeRun(id: string) { setParams({ run: id }); setPage(1); setSearch(''); setType(''); setStatus('unresolved') }
  function chooseTab(next: ResultTab) { setTab(next); setPage(1); setSearch(''); setType(''); setStatus('unresolved') }
  function tabKey(event: KeyboardEvent<HTMLButtonElement>) {
    const current = tabs.indexOf(tab)
    const next = event.key === 'ArrowRight' ? tabs[(current + 1) % tabs.length] : event.key === 'ArrowLeft' ? tabs[(current + tabs.length - 1) % tabs.length] : event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[tabs.length - 1] : null
    if (next) { event.preventDefault(); chooseTab(next); document.getElementById(`tab-${next}`)?.focus() }
  }
  return <>
    <div className="page-heading"><div><h1>Reconciliation</h1><p>Accepted relationships and differences in your recorded evidence.</p></div>{!demo && <button className="button primary" onClick={() => start.mutate()} disabled={start.isPending || !workspace?.input_revision}><Play size={16} />{start.isPending ? 'Reconciling...' : 'Start reconciliation'}</button>}</div>
    <ErrorMessage error={start.error || runs.error || run.error} />
    {run.data?.is_stale && <div className="alert warning"><RefreshCw size={17} /><span>Inputs or rules have changed. {demo ? 'These results describe the saved synthetic snapshot.' : 'Start reconciliation to include the latest records.'}</span></div>}
    {runs.isLoading && <Loading />}
    {!runId && !runs.isLoading && <section className="panel"><EmptyState title="No reconciliation runs yet">Confirm your source files, then start a run.</EmptyState><div className="empty-action"><Link to={`${prefix}/imports`} className="button secondary">Open imports<ArrowRight size={16} /></Link></div></section>}
    {runId && <>
      <section className="run-selector"><div><label htmlFor="run-select">Reconciliation run</label><select id="run-select" value={runs.data?.items.some(item => item.id === runId) ? runId : ''} onChange={event => changeRun(event.target.value)}>{!runs.data?.items.some(item => item.id === runId) && <option value="">Selected run {runId.slice(0, 8)}</option>}{runs.data?.items.map(item => <option value={item.id} key={item.id}>{displayTime(item.started_at)} / {item.id.slice(0, 8)} / {item.status}</option>)}</select></div>{run.data && <div className="run-meta"><Badge value={run.data.status} /><span>{run.data.source_counts.orders} orders / {run.data.source_counts.payments} payments / {run.data.source_counts.settlements} settlements</span></div>}</section>
      {runs.data && runs.data.total > 25 && <Pagination page={runPage} total={runs.data.total} onChange={setRunPage} />}
      {run.isLoading && <Loading />}
      {run.data?.status === 'running' && <div className="alert warning"><AlertTriangle size={17} />This run is incomplete. Partial results are not shown.<button className="text-link" onClick={() => run.refetch()}>Refresh status</button></div>}
      {run.data?.status === 'failed' && <div className="alert error"><AlertTriangle size={17} />The run failed. No partial result was accepted.</div>}
      {summary && run.data?.status === 'completed' && <>
        <div className="reconciliation-summary"><div><span>Matched order value</span><strong className="positive"><Money amounts={summary.matched_order_value} /></strong></div><div><span>Matched settlement net</span><strong className="positive"><Money amounts={summary.matched_settlement_value} /></strong></div><div><span>Unresolved cases</span><strong className="warning-text">{summary.unresolved_discrepancy_count}</strong></div></div>
        <section className="panel results-panel"><div className="result-tabs" role="tablist" aria-label="Reconciliation results">{tabs.map(key => <button key={key} id={`tab-${key}`} role="tab" type="button" aria-selected={tab === key} aria-controls={`results-${key}`} tabIndex={tab === key ? 0 : -1} onKeyDown={tabKey} onClick={() => chooseTab(key)}>{key === 'cases' ? <><AlertTriangle size={16} />Review cases<span>{summary.unresolved_discrepancy_count}</span></> : key === 'matches' ? <><CheckCircle2 size={16} />Accepted relationships<span>{summary.match_count}</span></> : 'Summary'}</button>)}</div>
          <div role="tabpanel" id={`results-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0}>
          {tab === 'summary' ? <div className="reconciliation-detail"><h2>Snapshot summary</h2><dl className="context-values"><div><dt>Eligible payment value</dt><dd><Money amounts={summary.total_payment_value} /></dd></div><div><dt>Affected recorded value</dt><dd><Money amounts={summary.unresolved_discrepancy_value} /></dd></div><div><dt>Eligible payments</dt><dd>{summary.total_eligible_payments} / {summary.total_payment_records}</dd></div><div><dt>Duplicate-group rows excluded</dt><dd>{summary.excluded_duplicate_payment_records}</dd></div><div><dt>Orders missing payment evidence</dt><dd>{summary.missing_payment_count}</dd></div><div><dt>Payments missing settlement evidence</dt><dd>{summary.missing_settlement_evidence_count}</dd></div></dl><p className="footnote">Currencies stay separate. Affected value groups overlapping evidence; it is not financial loss. Missing records do not prove a failed settlement.</p><details className="technical-details"><summary>Matching rules and fee configuration</summary><p>Unique references, equal currencies, exact integer amounts, successful payment status, and no conflicting allocation. Settlement matches also require the configured fee and gross-minus-fee equation. Partial payments are not combined automatically.</p><p>Fee configuration: {run.data.fee_configuration?.name || 'No fee rules recorded'}. {run.data.fee_configuration?.synthetic ? 'Synthetic demonstration rules; replace before reviewing real records.' : 'Only configured provider and currency rules are used.'}</p><p>Input revision {run.data.input_revision} / Rule {run.data.rule_version} / Snapshot {run.data.snapshot_hash}</p></details><Link className="text-link" to={`${prefix}/reports?run=${runId}`}>View full report<ArrowRight size={16} /></Link></div> : <>
          <div className="table-toolbar"><label className="search-field"><Search size={16} /><span className="sr-only">Search references</span><input value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} placeholder="Search a reference" maxLength={128} /></label>{tab === 'cases' && <select aria-label="Discrepancy type" value={type} onChange={event => { setType(event.target.value); setPage(1) }}><option value="">All discrepancy types</option>{Object.keys(summary.category_counts).sort((a, b) => casePriority(a) - casePriority(b)).map(category => <option value={category} key={category}>{caseTitle(category)}</option>)}</select>}{tab === 'cases' && <select aria-label="Case review status" value={status} onChange={event => { setStatus(event.target.value); setPage(1) }}><option value="unresolved">Unresolved cases</option><option value="">All review statuses</option>{['open', 'in_review', 'resolved', 'reopened'].map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select>}<span className="count-label" aria-live="polite">{currentList.data?.total ?? 0} results</span></div>
          <ErrorMessage error={currentList.error} />{currentList.isLoading && <Loading />}
          <div className="table-scroll results-table" role="region" aria-label={tab === 'cases' ? 'Review cases' : 'Accepted relationships'} tabIndex={0}>{tab === 'cases' ? <table><thead><tr><th scope="col">Case and reference</th><th scope="col">Recorded value</th><th scope="col">Severity</th><th scope="col">Status</th><th scope="col">Evidence</th></tr></thead><tbody>{cases.data?.items.map(item => { const view = presentCase(item); return <tr key={item.id}><td><Link className="table-link" to={`${prefix}/investigations?run=${runId}&case=${item.id}`}>{view.title}</Link><span className="table-description">{view.reference}</span></td><td className="nowrap">{view.value || 'See records'}{view.value && <span className="table-description">{view.valueLabel}</span>}</td><td><span className={`severity ${item.severity}`}>{item.severity}</span></td><td><Badge value={item.status} /></td><td><button className="text-link nowrap" onClick={() => setEvidence(item)}><FileSearch size={16} />View evidence</button></td></tr> })}</tbody></table> : <table><thead><tr><th scope="col">Relationship and reference</th><th scope="col">Payment reference</th><th scope="col">Provider</th><th scope="col">Decision</th><th scope="col">Evidence</th></tr></thead><tbody>{matches.data?.items.map(item => <tr key={item.id}><td className="reference"><span className="table-description">{item.kind === 'order_payment' ? 'Order to payment' : 'Payment to settlement'}</span>{item.source_records.find(record => record.record_type === 'order')?.order_ref || item.source_records.find(record => record.record_type === 'settlement')?.settlement_ref}</td><td className="reference">{item.source_records.find(record => record.record_type === 'payment')?.transaction_ref}</td><td>{item.source_records.find(record => record.record_type === 'payment')?.provider}</td><td><Badge value={item.origin === 'manual' ? 'manual' : 'matched'} /></td><td><button className="text-link nowrap" onClick={() => setEvidence(item)}><FileSearch size={16} />View evidence</button></td></tr>)}</tbody></table>}</div>
          {currentList.data?.total === 0 && <EmptyState title={search || type || status !== 'unresolved' ? 'No records match these filters' : tab === 'cases' ? 'No unresolved cases' : 'No accepted relationships'}>Try another filter or inspect the snapshot summary.</EmptyState>}
          {currentList.data && <Pagination page={page} total={currentList.data.total} onChange={setPage} />}
          </>}
          </div>
        </section>
        <p className="footnote">A match confirms agreement between records in this snapshot. It does not independently confirm receipt of funds.</p>
      </>}
    </>}
    {evidence && <EvidenceDialog item={evidence} onClose={() => setEvidence(null)} />}
  </>
}
