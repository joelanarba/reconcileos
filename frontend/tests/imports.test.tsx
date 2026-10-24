import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ImportsPage } from '../src/features/imports/ImportsPage'

const invalidBatch = {
  id: 'batch-1', filename: 'invalid.csv', source_type: 'orders', status: 'invalid', total_rows: 1, valid_rows: 0, invalid_rows: 1,
  preview: { columns: ['order_ref', 'amount'], items: [{ source_row: 2, raw: { order_ref: 'SYN-1', amount: 'bad' }, parsed: {}, errors: [{ field: 'amount', message: 'Use a valid decimal amount.' }], warnings: [] }], total: 1, page: 1, page_size: 25 },
}

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/imports']}><ImportsPage /></MemoryRouter></QueryClientProvider>)
}

afterEach(() => vi.unstubAllGlobals())

describe('import confirmation controls', () => {
  it('shows row errors and prevents confirmation of an invalid preview', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => new Response(JSON.stringify(String(input).endsWith('/imports?page=1') ? { items: [], total: 0, page: 1, page_size: 25 } : invalidBatch), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    mount()
    const user = userEvent.setup()
    await user.upload(screen.getByLabelText('Select a file'), new File(['order_ref,amount\nSYN-1,bad'], 'invalid.csv', { type: 'text/csv' }))
    await user.click(screen.getByRole('button', { name: 'Preview file' }))
    expect(await screen.findByText('amount: Use a valid decimal amount.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm import' })).toBeDisabled()
    expect(fetchMock.mock.calls.some(call => String(call[0]).includes('/confirm'))).toBe(false)
  })

  it('makes a real confirmation request only after a valid preview', async () => {
    let confirmed = false
    const valid = { ...invalidBatch, filename: 'valid.csv', status: 'previewed', valid_rows: 1, invalid_rows: 0,
      preview: { ...invalidBatch.preview, items: [{ ...invalidBatch.preview.items[0], errors: [], raw: { order_ref: 'SYN-1', amount: '1.00' } }] } }
    const fetchMock = vi.fn(async (input: string | URL | Request, options?: RequestInit) => {
      if (String(input).endsWith('/confirm')) { expect(options?.method).toBe('POST'); confirmed = true }
      const result = String(input).endsWith('/imports?page=1') ? { items: [], total: 0, page: 1, page_size: 25 } : { ...valid, status: confirmed ? 'confirmed' : 'previewed' }
      return new Response(JSON.stringify(result), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    mount()
    const user = userEvent.setup()
    expect(screen.getByRole('button', { name: 'Preview file' })).toBeDisabled()
    await user.upload(screen.getByLabelText('Select a file'), new File(['valid'], 'valid.csv', { type: 'text/csv' }))
    await user.click(screen.getByRole('button', { name: 'Preview file' }))
    await user.click(await screen.findByRole('button', { name: 'Confirm import' }))
    expect(await screen.findByText('1 record imported. Source values and provenance are preserved.')).toBeInTheDocument()
    expect(confirmed).toBe(true)
  })

  it('shows backend upload errors without presenting a successful preview', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => String(input).includes('/preview')
      ? new Response(JSON.stringify({ detail: { code: 'missing_columns', message: 'Missing required columns: currency.' } }), { status: 400 })
      : new Response(JSON.stringify({ items: [], total: 0, page: 1, page_size: 25 }), { status: 200 })))
    mount()
    const user = userEvent.setup()
    await user.upload(screen.getByLabelText('Select a file'), new File(['bad'], 'bad.csv', { type: 'text/csv' }))
    await user.click(screen.getByRole('button', { name: 'Preview file' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Missing required columns: currency.')
    expect(screen.queryByRole('button', { name: 'Confirm import' })).not.toBeInTheDocument()
  })
})
