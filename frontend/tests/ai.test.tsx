import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { AIAssistance } from '../src/features/investigations/AIAssistance'
import type { CaseDetail } from '../src/types/api'

const item = { id: 'case-1', version: 7 } as CaseDetail
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><AIAssistance item={item} /></QueryClientProvider>)
}
afterEach(() => vi.unstubAllGlobals())

it('shows honest unconfigured availability without fabricating an explanation', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ai: { available: false, message: 'AI assistance is not configured.' } }), { status: 200 })))
  mount()
  expect(await screen.findByText('AI assistance is not configured.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Request AI assistance' })).not.toBeInTheDocument()
  expect(screen.queryByText('AI hypothesis')).not.toBeInTheDocument()
})

it('requires evidence disclosure consent and keeps provider failure separate from review', async () => {
  const fetchMock = vi.fn(async (input: unknown, options?: RequestInit) => {
    if (String(input).endsWith('/workspace')) return new Response(JSON.stringify({ ai: { available: true, provider: 'synthetic.invalid', model: 'test-model', message: 'Configured for this test.' } }), { status: 200 })
    expect(JSON.parse(String(options?.body))).toEqual({ consent_to_send_evidence: true, expected_version: 7 })
    return new Response(JSON.stringify({ detail: { message: 'AI assistance timed out. Continue manual review.' } }), { status: 504 })
  })
  vi.stubGlobal('fetch', fetchMock)
  mount()
  const button = await screen.findByRole('button', { name: 'Request AI assistance' })
  expect(button).toBeDisabled()
  const user = userEvent.setup()
  await user.click(screen.getByRole('checkbox'))
  await user.click(button)
  expect(await screen.findByRole('alert')).toHaveTextContent('AI assistance timed out.')
  expect(fetchMock.mock.calls.filter(call => String(call[0]).includes('/review'))).toHaveLength(0)
})
