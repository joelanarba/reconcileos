import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { CaseDetail, Workspace } from '../../types/api'
import { api } from '../../lib/api'
import { ErrorMessage } from '../../components/common'

export function AIAssistance({ item }: { item: CaseDetail }) {
  const client = useQueryClient()
  const [consent, setConsent] = useState(false)
  const workspace = useQuery({ queryKey: ['workspace'], queryFn: () => api<Workspace>('/workspace') })
  const mutation = useMutation({ mutationFn: () => api<CaseDetail>(`/investigations/${item.id}/ai`, { method: 'POST', body: JSON.stringify({ consent_to_send_evidence: consent, expected_version: item.version }) }), onSuccess: result => {
    client.setQueryData(['investigation', item.id], result); client.invalidateQueries(); setConsent(false)
  } })
  return <section className="proposal-box" aria-label="Optional AI assistance"><h3>AI investigation assistance</h3>
    <p className="footnote">{workspace.data?.ai?.message || 'Checking server configuration...'}</p>
    {workspace.data?.ai?.available && <>
      <p className="footnote">Provider: {workspace.data.ai.provider} / Model: {workspace.data.ai.model}. A request sends up to 20 related records and 16 KiB of selected evidence, including references, amounts, dates, statuses, and bounded descriptions. Original file columns and unrelated records are excluded.</p>
      <label className="consent-control"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />Send this case's selected evidence to the configured provider for a hypothesis.</label>
      <button className="button secondary" disabled={!consent || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? 'Investigating evidence...' : 'Request AI assistance'}</button>
    </>}
    <ErrorMessage error={workspace.error || mutation.error} />
    <p className="footnote">AI cannot approve matches, edit imported values, resolve cases, or confirm that funds were received. Its explanations require human review.</p>
  </section>
}
