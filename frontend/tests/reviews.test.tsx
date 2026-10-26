import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { CasePanel } from '../src/features/investigations/InvestigationsPage'
import type { CaseDetail } from '../src/types/api'

const item: CaseDetail = { id: 'case-1', run_id: 'run-1', type: 'missing_payment', severity: 'high', status: 'open', description: 'No successful evidence.', version: 1,
  evidence: { records: [], rule: 'No same-reference payment.' }, source_records: [], snapshot_hash: 'abc123', manual_matches: [], investigations: [], decisions: [], audit_history: [] }

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><MemoryRouter><CasePanel item={item} /></MemoryRouter></QueryClientProvider>)
}

afterEach(() => vi.unstubAllGlobals())

it('requires a documented reason and submits the current case version', async () => {
  const fetchMock = vi.fn(async (input: unknown, options: RequestInit) => {
    if (String(input).endsWith('/workspace')) return new Response(JSON.stringify({ ai: { available: false, message: 'AI is not configured.' } }), { status: 200 })
    expect(new Headers(options.headers).get('Content-Type')).toBe('application/json')
    expect(JSON.parse(String(options.body))).toEqual({ action: 'resolve', expected_version: 1, reason: 'Checked the source statement.' })
    return new Response(JSON.stringify({ ...item, status: 'resolved', version: 2 }), { status: 200 })
  })
  vi.stubGlobal('fetch', fetchMock)
  mount()
  expect(screen.getByRole('button', { name: 'Resolve case' })).toBeDisabled()
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Reason or investigation note'), 'Checked the source statement.')
  await user.click(screen.getByRole('button', { name: 'Resolve case' }))
  expect(await screen.findByText('Review saved with audit history.')).toBeInTheDocument()
  expect(fetchMock.mock.calls.filter(call => String(call[0]).endsWith('/review'))).toHaveLength(1)
})

it('shows a stale-review conflict and preserves the written note', async () => {
  vi.stubGlobal('fetch', vi.fn(async (input: unknown) => String(input).endsWith('/workspace') ? new Response(JSON.stringify({ ai: { available: false, message: 'AI is not configured.' } }), { status: 200 }) : new Response(JSON.stringify({ detail: { message: 'This case changed. Refresh its evidence and history before trying again.' } }), { status: 409 })))
  mount()
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Reason or investigation note'), 'Keep this note.')
  await user.click(screen.getByRole('button', { name: 'Add note' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('This case changed.')
  expect(screen.getByLabelText('Reason or investigation note')).toHaveValue('Keep this note.')
  expect(screen.queryByText('Review saved with audit history.')).not.toBeInTheDocument()
})

it('shows saved AI evidence and uncertainty in the read-only case without mutation controls', () => {
  const client = new QueryClient()
  const record = { id: 'o1', record_type: 'order' as const, currency: 'GHS', expected_minor: '12550', order_ref: 'SYN-ORDER', import_batch_id: 'b1', source_row: 2, raw: { amount: '125.50' }, description: '' }
  const saved = { ...item, source_records: [record], investigations: [{ id: 'ai1', kind: 'ai', actor: 'Demo preparation', created_at: '2026-10-25T10:00:00Z', explanation: 'A saved provider hypothesis.', suggested_action: 'Verify the payment reference.', evidence: { supporting_record_ids: ['order:o1'], alternative_explanations: ['A separate payment export may exist.'], limitations: ['No receipt is confirmed.'], confidence_classification: 'low' }, ai_metadata: { provider: 'api.openai.com', model: 'recorded-model' } }] }
  render(<QueryClientProvider client={client}><MemoryRouter><CasePanel item={saved} demo /></MemoryRouter></QueryClientProvider>)
  expect(screen.getByRole('heading', { name: 'Saved AI investigation' })).toBeInTheDocument()
  expect(screen.getByText('No receipt is confirmed.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'order: SYN-ORDER' })).toHaveAttribute('href', '#record-order-o1')
  expect(screen.getByText('GHS 125.50', { selector: 'dd' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Resolve case' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Request AI assistance' })).not.toBeInTheDocument()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(screen.queryByText(/Validated structured/)).not.toBeInTheDocument()
})
