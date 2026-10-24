import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ImportMapping } from '../src/features/imports/ImportMapping'
import type { Batch, ImportOptions } from '../src/types/api'

const options: ImportOptions = { column_map: {}, default_currency: 'GHS', default_provider: '', default_status: '', default_date: '', timezone: 'Africa/Accra', date_order: 'DMY', decimal_style: 'auto', allow_cached_formulas: false, status_map: {}, corrections: {}, excluded_rows: [], reason: '' }
const batch: Batch = {
  id: 'mapping-batch', filename: 'ordinary-export.csv', source_type: 'orders', checksum: 'test', status: 'invalid', total_rows: 1, valid_rows: 0, invalid_rows: 1, created_at: '2026-10-20T00:00:00Z', confirmed_at: null,
  preview: { columns: ['Ticket', 'Collected', 'Booked'], items: [], page: 1, page_size: 25, total: 1 },
  import_info: { format: 'CSV', encoding: 'windows-1252', delimiter: ';', sheets: ['CSV'], sheet: 'CSV', header_row: 1, mapping: { order_ref: null, amount: null, ordered_at: null },
    fields: [{ key: 'order_ref', label: 'Order reference', required: true }, { key: 'amount', label: 'Amount', required: true }, { key: 'ordered_at', label: 'Order date', required: true }], options, revision: 3, transformed_rows: 0, excluded_rows: 0, unknown_statuses: [], allowed_statuses: ['open', 'completed', 'cancelled'] },
}

describe('existing export interpretation', () => {
  it('maps the user column names without requiring the file to be rewritten', async () => {
    const apply = vi.fn()
    render(<ImportMapping batch={batch} onApply={apply} pending={false} error={null} />)
    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText('Order reference'), 'Ticket')
    await user.selectOptions(screen.getByLabelText('Amount'), 'Collected')
    await user.selectOptions(screen.getByLabelText('Order date'), 'Booked')
    await user.selectOptions(screen.getByLabelText('Number format'), 'comma')
    await user.click(screen.getByRole('button', { name: 'Apply mapping' }))
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ expected_revision: 3, column_map: { order_ref: 'Ticket', amount: 'Collected', ordered_at: 'Booked' }, decimal_style: 'comma' }))
  })

  it('keeps an unfamiliar status unresolved until the operator assigns a meaning', async () => {
    const apply = vi.fn()
    const unfamiliar = { ...batch, source_type: 'payments' as const, import_info: { ...batch.import_info!, unknown_statuses: ['OKAY'], allowed_statuses: ['successful', 'pending', 'failed', 'reversed'] } }
    render(<ImportMapping batch={unfamiliar} onApply={apply} pending={false} error={null} />)
    const user = userEvent.setup()
    expect(screen.getByLabelText('Source status: OKAY')).toHaveValue('')
    await user.selectOptions(screen.getByLabelText('Source status: OKAY'), 'successful')
    await user.click(screen.getByRole('button', { name: 'Apply mapping' }))
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ status_map: { OKAY: 'successful' } }))
  })
})
