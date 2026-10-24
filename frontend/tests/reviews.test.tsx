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
  const fetchMock = vi.fn(async (_input: unknown, options: RequestInit) => {
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
  expect(fetchMock).toHaveBeenCalledOnce()
})

it('shows a stale-review conflict and preserves the written note', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ detail: { message: 'This case changed. Refresh its evidence and history before trying again.' } }), { status: 409 })))
  mount()
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Reason or investigation note'), 'Keep this note.')
  await user.click(screen.getByRole('button', { name: 'Add note' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('This case changed.')
  expect(screen.getByLabelText('Reason or investigation note')).toHaveValue('Keep this note.')
  expect(screen.queryByText('Review saved with audit history.')).not.toBeInTheDocument()
})
