import { describe, expect, it } from 'vitest'
import { formatMoney, moneyLines } from '../src/lib/money'

describe('exact monetary presentation', () => {
  it('respects each supported currency precision', () => {
    expect(formatMoney('12550', 'GHS')).toBe('GHS 125.50')
    expect(formatMoney('125', 'JPY')).toBe('JPY 125')
    expect(formatMoney('1005', 'KWD')).toBe('KWD 1.005')
  })
  it('never converts large monetary integers through binary floating point', () => {
    expect(formatMoney('9007199254740993', 'GHS')).toBe('GHS 90,071,992,547,409.93')
  })
  it('keeps currencies separate and rejects unsupported input', () => {
    expect(moneyLines({ USD: '100', GHS: '200' })).toEqual(['GHS 2.00', 'USD 1.00'])
    expect(moneyLines({})).toEqual([])
    expect(() => formatMoney('1.1', 'GHS')).toThrow()
    expect(() => formatMoney('1', 'ZZZ')).toThrow()
  })
})
