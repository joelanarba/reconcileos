import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileSearch, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { formatMoney } from '../../lib/money'
import type { CaseDetail, Discrepancy, Page, Run } from '../../types/api'
import { Badge, displayTime, EmptyState, ErrorMessage, Loading, Pagination } from '../../components/common'
import { EvidenceDialog } from '../../components/EvidenceDialog'

export function InvestigationsPage() {
  const [params, setParams] = useSearchParams()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const runs = useQuery({ queryKey: ['runs', 'investigations'], queryFn: () => api<Page<Run>>('/runs?page_size=100') })
  const runId = params.get('run') || runs.data?.items.find(run => run.status === 'completed')?.id || ''
  const caseId = params.get('case') || ''
  const cases = useQuery({ queryKey: ['cases', runId, page, search, status], enabled: !!runId, queryFn: () => api<Page<Discrepancy>>(`/discrepancies?run_id=${runId}&page=${page}&search=${encodeURIComponent(search)}&status=${status}`) })
  const detail = useQuery({ queryKey: ['investigation', caseId], enabled: !!caseId, queryFn: () => api<CaseDetail>(`/investigations/${caseId}`) })
  useEffect(() => { if (caseId && detail.data) document.getElementById('case-title')?.scrollIntoView({ block: 'start' }) }, [caseId, !!detail.data])
  return <>
    <div className="page-heading"><div><div className="eyebrow">CASE MANAGEMENT</div><h1>Investigations</h1><p>Inspect evidence and document decisions. Case disposition does not move money.</p></div></div>
    <ErrorMessage error={runs.error || cases.error || detail.error} />
    <section className="panel run-selector"><label>Reconciliation run<select value={runId} onChange={event => { setParams({ run: event.target.value }); setPage(1) }}><option value="">Choose a completed run</option>{runId && !runs.data?.items.some(run => run.id === runId) && <option value={runId}>Selected run {runId.slice(0, 8)}</option>}{runs.data?.items.filter(run => run.status === 'completed').map(run => <option value={run.id} key={run.id}>{displayTime(run.started_at)} / {run.id.slice(0, 8)}</option>)}</select></label><Link to="/reconciliation" className="text-link">Open reconciliation</Link></section>
    {!runId && !runs.isLoading && <EmptyState title="No completed run to investigate">Import records and complete reconciliation first.</EmptyState>}
    {runId && <section className="panel">
      <div className="table-toolbar"><label className="search-field"><Search size={16} /><span className="sr-only">Search investigation references</span><input placeholder="Reference or description" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} maxLength={128} /></label><select aria-label="Case status" value={status} onChange={event => { setStatus(event.target.value); setPage(1) }}><option value="">All statuses</option>{['open', 'in_review', 'resolved', 'reopened'].map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></div>
      {cases.isLoading && <Loading />}<div className="table-scroll"><table><thead><tr><th>Case</th><th>Severity</th><th>Status</th><th>Action</th></tr></thead><tbody>{cases.data?.items.map(item => <tr key={item.id}><td><strong className="table-title">{item.type.replaceAll('_', ' ')}</strong><span className="table-description">{item.source_records.map(record => record.order_ref || record.transaction_ref || record.settlement_ref).filter(Boolean).slice(0, 3).join(' / ')}</span></td><td><Badge value={item.severity} /></td><td><Badge value={item.status} /></td><td><button className="text-link nowrap" onClick={() => setParams({ run: runId, case: item.id })}><FileSearch size={15} />Investigate</button></td></tr>)}</tbody></table></div>
      {cases.data?.total === 0 && <EmptyState title="No cases match these filters">Change the search or status filter.</EmptyState>}{cases.data && <Pagination page={page} total={cases.data.total} onChange={setPage} />}
    </section>}
    {detail.isLoading && caseId && <Loading />}{detail.data && <CasePanel key={detail.data.id} item={detail.data} />}
  </>
}

export function CasePanel({ item }: { item: CaseDetail }) {
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')
  const [selected, setSelected] = useState('')
  const [evidence, setEvidence] = useState(false)
  const [message, setMessage] = useState('')
  const candidates = item.evidence.candidates || {}
  const orders = item.source_records.filter(record => record.record_type === 'order' && candidates.order_ids?.includes(record.id))
  const payments = item.source_records.filter(record => record.record_type === 'payment' && candidates.payment_ids?.includes(record.id))
  const pairs = orders.flatMap(order => payments.filter(payment => payment.currency === order.currency && payment.amount_minor === order.expected_minor && payment.provider_status === 'successful').map(payment => ({ order, payment }))).slice(0, 100)
  const mutation = useMutation({ mutationFn: (action: { action: string; match_id?: string }) => {
    const pair = pairs.find(pair => `${pair.order.id}|${pair.payment.id}` === selected)
    return api<CaseDetail>(`/investigations/${item.id}/review`, { method: 'POST', body: JSON.stringify({ ...action, expected_version: item.version, reason, ...(action.action.endsWith('_match') && action.action !== 'reverse_match' ? { order_id: pair?.order.id, payment_id: pair?.payment.id } : {}) }) })
  }, onSuccess: result => { queryClient.setQueryData(['investigation', item.id], result); queryClient.invalidateQueries(); setReason(''); setMessage('Review saved with audit history.') } })
  const disabled = reason.trim().length < 3 || mutation.isPending
  function act(action: string, match_id?: string) { setMessage(''); mutation.mutate({ action, ...(match_id ? { match_id } : {}) }) }
  return <section className="panel case-panel" aria-labelledby="case-title">
    <div className="panel-heading"><div><div className="eyebrow">SELECTED CASE / {item.id.slice(0, 8)}</div><h2 id="case-title">{item.type.replaceAll('_', ' ')}</h2></div><Badge value={item.status} /></div>
    <div className="case-content"><p>{item.description}</p><div className="rule-box"><h3>Flagged by this rule</h3><p>{item.evidence.rule}</p></div><button className="button secondary" onClick={() => setEvidence(true)}><FileSearch size={15} />Inspect supporting records ({item.source_records.length})</button>
      <p className="footnote">Snapshot {item.snapshot_hash.slice(0, 12)} / Review version {item.version}. Original records and automatic results are retained.</p>
      <h3>Document a review action</h3><label className="review-reason">Reason or investigation note<textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={2000} rows={3} placeholder="Describe what you checked and why this action is appropriate." /></label>
      <ErrorMessage error={mutation.error} />{message && <p role="status" className="positive">{message}</p>}
      <div className="review-actions"><button className="button secondary" disabled={disabled} onClick={() => act('note')}>Add note</button>{['open', 'reopened'].includes(item.status) && <button className="button secondary" disabled={disabled} onClick={() => act('start_review')}>Start review</button>}{item.status !== 'resolved' ? <button className="button primary" disabled={disabled} onClick={() => act('resolve')}>Resolve case</button> : <button className="button primary" disabled={disabled} onClick={() => act('reopen')}>Reopen case</button>}</div>
      {!!pairs.length && <div className="proposal-box"><h3>Proposed order and payment associations</h3><p className="footnote">Equal recorded amounts suggest candidates. Approval checks eligibility and existing allocations again on the server. Other related cases stay open until reviewed.</p><label>Proposed association<select aria-label="Proposed association" value={selected} onChange={event => setSelected(event.target.value)}><option value="">Choose supporting records</option>{pairs.map(pair => <option key={`${pair.order.id}|${pair.payment.id}`} value={`${pair.order.id}|${pair.payment.id}`}>{pair.order.order_ref} / {pair.payment.transaction_ref} / {formatMoney(pair.payment.amount_minor || '0', pair.payment.currency)}</option>)}</select></label><div className="review-actions"><button className="button primary" disabled={disabled || !selected || item.status === 'resolved'} onClick={() => act('approve_match')}>Approve association</button><button className="button secondary" disabled={disabled || !selected || item.status === 'resolved'} onClick={() => act('reject_match')}>Reject proposal</button></div></div>}
      {!!item.manual_matches.length && <div className="proposal-box"><h3>Active manual associations</h3>{item.manual_matches.map(match => <div key={match.id} className="manual-match"><code>{match.id.slice(0, 8)}</code><span>Accepted order-payment relationship</span><button className="button secondary compact" disabled={disabled} onClick={() => act('reverse_match', match.id)}>Reverse association</button></div>)}</div>}
      <h3>Investigation notes</h3>{!item.investigations.length && <p className="muted">No notes recorded.</p>}{item.investigations.map(note => <article className="history-entry" key={note.id}><strong>{note.actor} / {displayTime(note.created_at)}</strong><p>{note.explanation}</p></article>)}
      <h3>Audit history</h3>{!item.audit_history.length && <p className="muted">No review actions recorded.</p>}{item.audit_history.map(event => <article className="history-entry" key={event.id}><strong>{event.action.replaceAll('_', ' ')} / {event.actor}</strong><small>{displayTime(event.timestamp)} / {event.previous_state.status} to {event.new_state.status} / version {event.new_state.version}</small><p>{event.reason}</p></article>)}
      <p className="footnote">The local operator is an operational label, not verified authentication. History is append-only through application operations, not cryptographically immutable.</p>
    </div>{evidence && <EvidenceDialog item={item} onClose={() => setEvidence(false)} />}
  </section>
}
