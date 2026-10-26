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
  return <section className="ai-assistance" aria-label="Optional AI assistance"><h2>Ask AI to examine this evidence</h2>
    <p>{workspace.data?.ai?.available ? 'Request possible explanations and an investigation step. Results are saved for human review.' : workspace.data?.ai?.message || 'Checking server configuration...'}</p>
    {workspace.data?.ai?.available && <>
      <details className="technical-details"><summary>Evidence sent to the provider</summary><p>Provider: {workspace.data.ai.provider} / Model: {workspace.data.ai.model}. Up to 20 related records and 16 KiB: references, exact amounts, dates, statuses, and bounded descriptions. Original file columns and unrelated records are excluded. Configuration does not establish live availability.</p></details>
      <label className="consent-control"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />Send this case's selected evidence to the configured provider for a hypothesis.</label>
      <button className="button secondary" disabled={!consent || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? 'Investigating evidence...' : 'Request AI assistance'}</button>
    </>}
    <ErrorMessage error={workspace.error || mutation.error} />
    <p className="footnote">AI cannot change amounts, approve matches, resolve cases, or confirm receipt of funds.</p>
  </section>
}
