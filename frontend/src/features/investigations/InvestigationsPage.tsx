import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { formatMoney } from '../../lib/money'
import type { CaseDetail, Discrepancy, Page, Run } from '../../types/api'
import { Badge, displayTime, EmptyState, ErrorMessage, Loading, Pagination } from '../../components/common'
import { EvidenceComparison } from '../../components/EvidenceComparison'
import { AIAssistance } from './AIAssistance'
import { SavedInvestigation } from './SavedInvestigation'
import { caseTitle, presentCase } from './casePresentation'

export function InvestigationsPage({ demo = false }: { demo?: boolean } = {}) {
  const [params, setParams] = useSearchParams()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('unresolved')
  const caseId = params.get('case') || ''
  const category = params.get('type') || ''
  const runs = useQuery({ queryKey: ['runs', 'investigations'], enabled: !caseId, queryFn: () => api<Page<Run>>('/runs?page_size=100') })
  const runId = params.get('run') || runs.data?.items.find(run => run.status === 'completed')?.id || ''
  const cases = useQuery({ queryKey: ['cases', runId, page, search, status, category], enabled: !!runId && !caseId, queryFn: () => api<Page<Discrepancy>>(`/discrepancies?run_id=${runId}&page=${page}&search=${encodeURIComponent(search)}&status=${status}&type=${encodeURIComponent(category)}`) })
  const detail = useQuery({ queryKey: ['investigation', caseId], enabled: !!caseId, queryFn: () => api<CaseDetail>(`/investigations/${caseId}`) })
  useEffect(() => { if (caseId && detail.data) document.getElementById('case-title')?.focus() }, [caseId, !!detail.data])
  if (caseId) return <>
    <Link className="text-link case-back" to={`${demo ? '/demo' : ''}/investigations?run=${detail.data?.run_id || runId}${category ? `&type=${encodeURIComponent(category)}` : ''}`}><ArrowLeft size={16} />Back to investigations</Link>
    <ErrorMessage error={detail.error} />
    {detail.isLoading && <Loading />}
    {detail.isError && <button className="button secondary" onClick={() => detail.refetch()}>Reload case</button>}
    {detail.data && <CasePanel key={detail.data.id} item={detail.data} demo={demo} />}
  </>
  return <>
    <div className="page-heading"><div><h1>Investigations</h1><p>Review the evidence, then document your decision.</p></div></div>
    <ErrorMessage error={runs.error || cases.error} />
    <section className="run-selector"><label>Reconciliation run<select value={runId} onChange={event => { setParams({ run: event.target.value }); setPage(1) }}><option value="">Choose a completed run</option>{runId && !runs.data?.items.some(run => run.id === runId) && <option value={runId}>Selected run {runId.slice(0, 8)}</option>}{runs.data?.items.filter(run => run.status === 'completed').map(run => <option value={run.id} key={run.id}>{displayTime(run.started_at)} / {run.id.slice(0, 8)}</option>)}</select></label><Link to={`${demo ? '/demo' : ''}/reconciliation?run=${runId}`} className="text-link">Open reconciliation</Link></section>
    {runs.isLoading && <Loading />}
    {!runId && !runs.isLoading && <EmptyState title="No completed run to investigate">Import records and complete reconciliation first.</EmptyState>}
    {runId && <section className="panel">
      {category && <div className="filter-context">{caseTitle(category)}<button className="text-link" onClick={() => { setParams({ run: runId }); setPage(1) }}>Clear category filter</button></div>}
      <div className="table-toolbar"><label className="search-field"><Search size={16} /><span className="sr-only">Search investigation references</span><input placeholder="Search a reference" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} maxLength={128} /></label><select aria-label="Case status" value={status} onChange={event => { setStatus(event.target.value); setPage(1) }}><option value="unresolved">Unresolved cases</option><option value="">All statuses</option>{['open', 'in_review', 'resolved', 'reopened'].map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></div>
      {cases.isLoading && <Loading />}<div className="table-scroll" role="region" aria-label="Investigation queue" tabIndex={0}><table><thead><tr><th scope="col">Case and reference</th><th scope="col">Severity</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead><tbody>{cases.data?.items.map(item => <tr key={item.id}><td><strong className="table-title">{caseTitle(item.type)}</strong><span className="table-description">{presentCase(item).reference}</span></td><td><span className={`severity ${item.severity}`}>{item.severity}</span></td><td><Badge value={item.status} /></td><td><button className="text-link nowrap" aria-label={`Investigate ${presentCase(item).reference}`} onClick={() => setParams({ run: runId, case: item.id, ...(category ? { type: category } : {}) })}>Investigate</button></td></tr>)}</tbody></table></div>
      {cases.data?.total === 0 && <EmptyState title="No cases match these filters">Change the search or status filter.</EmptyState>}{cases.data && <Pagination page={page} total={cases.data.total} onChange={setPage} />}
    </section>}
  </>
}

export function CasePanel({ item, demo = false }: { item: CaseDetail; demo?: boolean }) {
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')
  const [selected, setSelected] = useState('')
  const [message, setMessage] = useState('')
  const presentation = presentCase(item)
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
  const aiNotes = item.investigations.filter(note => note.kind === 'ai')
  const humanNotes = item.investigations.filter(note => note.kind !== 'ai')
  return <section className="case-panel" aria-labelledby="case-title">
    <header className="case-header"><div><p className="case-reference">Case {item.id.slice(0, 8)} / {presentation.reference}</p><h1 id="case-title" tabIndex={-1}>{presentation.title}</h1><div className="case-status"><span className={`severity ${item.severity}`}>{item.severity} severity</span><Badge value={item.status} /></div></div><div className="case-header-action">{presentation.value && <div><span>{presentation.valueLabel}</span><strong>{presentation.value}</strong></div>}{!demo && <a className="button primary" href="#review-controls">{item.status === 'resolved' ? 'Review resolution' : 'Record a decision'}</a>}</div></header>
    <div className="case-finding"><h2>What the records show</h2><p>{presentation.finding}</p><p className="case-uncertainty">{presentation.uncertainty}</p>{!!item.manual_matches.length && <p className="case-uncertainty positive">A human-approved association is now active. The original automatic finding and source values are retained below.</p>}</div>
    <section className="case-evidence" aria-labelledby="comparison-title"><div className="section-heading"><h2 id="comparison-title">Supporting evidence</h2><span className="muted">{item.source_records.length} records in this snapshot</span></div><EvidenceComparison records={item.source_records} demo={demo} /><details className="technical-details"><summary>Rule and snapshot details</summary><p>{item.evidence.rule}</p><p>Snapshot {item.snapshot_hash} / Review version {item.version}. Imported records and original automatic results are retained.</p></details></section>
    <div className="case-work-grid"><div className="case-analysis"><section className="next-step"><h2>Recommended next step</h2><p>{presentation.nextStep}</p></section>
      {demo && !aiNotes.length && <div className="scope-note">No saved AI investigation is available for this case. Public visitors cannot send evidence to a provider.</div>}
      {aiNotes.map(note => <SavedInvestigation key={note.id} note={note} records={item.source_records} />)}
      {!demo && <AIAssistance item={item} />}
      <section className="case-notes"><h2>Investigation notes</h2>{!humanNotes.length && <p className="muted">No operator notes yet.</p>}{humanNotes.map(note => <article className="history-entry" key={note.id}><strong>Operator note</strong><small>{note.actor} / {displayTime(note.created_at)}</small><p>{note.explanation}</p></article>)}</section>
    </div><section className="review-panel" id="review-controls" aria-labelledby="review-title"><h2 id="review-title">{demo ? 'Human review' : 'Document a review action'}</h2>
      {demo ? <><p>This synthetic workspace is read-only. Operator decisions require a reason and are saved in the audit history.</p><Link className="text-link" to="/login">Sign in to your workspace</Link></> : <>
        <p>Record what you checked. Resolving a case records its disposition; it does not confirm receipt or settlement.</p>
        <label className="review-reason">Reason or investigation note<textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={2000} rows={4} placeholder="Evidence checked and reason for this decision" aria-describedby="reason-help" /></label><p id="reason-help" className="footnote">At least 3 characters. Your reason stays in the review history.</p>
        <ErrorMessage error={mutation.error} />{message && <p role="status" className="positive">{message}</p>}
        <div className="review-actions"><button className="button secondary" disabled={disabled} onClick={() => act('note')}>Add note</button>{['open', 'reopened'].includes(item.status) && <button className="button secondary" disabled={disabled} onClick={() => act('start_review')}>Start review</button>}{item.status !== 'resolved' ? <button className="button primary" disabled={disabled} onClick={() => act('resolve')}>{mutation.isPending ? 'Saving...' : 'Resolve case'}</button> : <button className="button primary" disabled={disabled} onClick={() => act('reopen')}>Reopen case</button>}</div>
        {!!pairs.length && <div className="proposal-box"><h3>Proposed associations</h3><p className="footnote">Approval rechecks eligibility and allocations. Related cases remain open.</p><label>Proposed association<select aria-label="Proposed association" value={selected} onChange={event => setSelected(event.target.value)}><option value="">Choose supporting records</option>{pairs.map(pair => <option key={`${pair.order.id}|${pair.payment.id}`} value={`${pair.order.id}|${pair.payment.id}`}>{pair.order.order_ref} / {pair.payment.transaction_ref} / {formatMoney(pair.payment.amount_minor || '0', pair.payment.currency)}</option>)}</select></label><div className="review-actions"><button className="button primary" disabled={disabled || !selected || item.status === 'resolved'} onClick={() => act('approve_match')}>Approve association</button><button className="button secondary" disabled={disabled || !selected || item.status === 'resolved'} onClick={() => act('reject_match')}>Reject proposal</button></div></div>}
        {!!item.manual_matches.length && <div className="proposal-box"><h3>Active manual associations</h3>{item.manual_matches.map(match => <div key={match.id} className="manual-match"><code>{match.id.slice(0, 8)}</code><span>Accepted order-payment relationship</span><button className="button secondary compact" disabled={disabled} onClick={() => act('reverse_match', match.id)}>Reverse association</button></div>)}</div>}
      </>}
    </section></div>
    <details className="audit-trail" open={item.audit_history.length > 0}><summary>Audit history ({item.audit_history.length})</summary>{!item.audit_history.length && <p className="muted">No review actions recorded.</p>}{item.audit_history.map(event => <article className="history-entry" key={event.id}><strong>{event.action.replaceAll('_', ' ')}</strong><small>{event.actor} / {displayTime(event.timestamp)} / {event.previous_state.status} to {event.new_state.status} / version {event.new_state.version}</small><p>{event.reason}</p></article>)}</details>
  </section>
}
