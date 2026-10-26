import { describe, expect, it } from 'vitest'
import type { Discrepancy, SourceRecord } from '../src/types/api'
import { presentCase } from '../src/features/investigations/casePresentation'

const order = { record_type: 'order', id: 'o', order_ref: 'ORDER-1', currency: 'GHS', expected_minor: '75000' } as SourceRecord
const payment = { record_type: 'payment', id: 'p', transaction_ref: 'PAY-1', currency: 'GHS', amount_minor: '70000' } as SourceRecord
function item(type: string, records: SourceRecord[], details = {}): Discrepancy {
  return { id: 'case-1', run_id: 'run-1', severity: 'medium', status: 'open', version: 1, type, description: 'Recorded rule finding.', source_records: records, evidence: { records: [], rule: 'Recorded rule.', details } }
}

describe('evidence-centered financial explanations', () => {
  it('uses exact source amounts and a qualified difference for a partial payment', () => {
    const view = presentCase(item('partial_payment', [order, payment]))
    expect(view.finding).toContain('GHS 750.00')
    expect(view.finding).toContain('GHS 700.00')
    expect(view.finding).toContain('GHS 50.00')
    expect(view.uncertainty).toContain('not confirmed loss')
    expect(view.valueLabel).toBe('Expected order value')
  })
  it('does not combine partial payments or invent a remaining balance', () => {
    const view = presentCase(item('partial_payment', [order, payment, { ...payment, id: 'p2' }]))
    expect(view.finding).toContain('2 related payment records')
    expect(view.finding).not.toContain('recorded difference')
    expect(view.uncertainty).toContain('not combined automatically')
  })
  it('keeps currencies separate without inventing a difference or conversion', () => {
    const view = presentCase(item('currency_mismatch', [order, { ...payment, currency: 'USD' }]))
    expect(view.finding).toContain('GHS 750.00')
    expect(view.finding).toContain('USD 700.00')
    expect(view.finding).not.toContain('recorded difference')
    expect(view.finding).toContain('cannot be compared')
  })
  it('uses integer precision above the JavaScript safe integer limit', () => {
    const view = presentCase(item('partial_payment', [{ ...order, expected_minor: '900719925474099300' }, { ...payment, amount_minor: '900719925474099299' }]))
    expect(view.finding).toContain('GHS 0.01')
  })
  it('formats fee evidence with the actual currency precision', () => {
    const settlement = { record_type: 'settlement', id: 's', settlement_ref: 'SET-1', currency: 'KWD', fee_minor: '125', gross_minor: '1000' } as SourceRecord
    const view = presentCase(item('fee_discrepancy', [settlement], { expected_fee_minor: '100' }))
    expect(view.finding).toContain('KWD 0.125')
    expect(view.finding).toContain('KWD 0.100')
  })
  it('keeps missing settlement evidence distinct from settlement failure', () => {
    expect(presentCase(item('missing_settlement_evidence', [payment])).uncertainty).toBe('Missing settlement evidence does not prove settlement failure.')
  })
  it.each([
    ['duplicate_notification', [payment, { ...payment, id: 'p2', provider: 'MTN' }], '2 payment notifications'],
    ['duplicate_import_row', [order, { ...order, id: 'o2' }], '2 identical order rows'],
    ['ambiguous_match', [order, { ...order, id: 'o2' }, payment], '2 order records and 1 payment record'],
    ['ambiguous_settlement', [payment, { id: 's1', record_type: 'settlement' }, { id: 's2', record_type: 'settlement' }], '2 settlement records'],
    ['unmatched_payment', [payment, order], 'Payment PAY-1 records GHS 700.00'],
    ['missing_payment', [order], 'Order ORDER-1 expects GHS 750.00'],
    ['fee_rule_missing', [{ record_type: 'settlement', settlement_ref: 'SET-1', provider: 'MTN', currency: 'GHS' }], 'MTN and GHS'],
    ['unmatched_settlement', [{ record_type: 'settlement', settlement_ref: 'SET-1', currency: 'GHS', gross_minor: '70000' }], 'gross GHS 700.00 without a payment reference'],
  ] as [string, SourceRecord[], string][])('describes %s from its actual references and record counts', (type, records, expected) => {
    expect(presentCase(item(type, records)).finding).toContain(expected)
  })
  it('explains a settlement equation difference using its own currency and exact net', () => {
    const settlement = { id: 's1', record_type: 'settlement', settlement_ref: 'SET-1', currency: 'GHS', gross_minor: '70000', fee_minor: '150', net_minor: '69800' } as SourceRecord
    const finding = presentCase(item('settlement_discrepancy', [payment, settlement])).finding
    expect(finding).toContain('Recorded net GHS 698.00')
    expect(finding).toContain('gross minus fee (GHS 698.50)')
  })
})
