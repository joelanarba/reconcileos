import type { MoneyMap } from '../types/api'

export const PRECISION: Record<string, number> = { GHS: 2, USD: 2, EUR: 2, GBP: 2, JPY: 0, KWD: 3 }

export function formatMoney(minor: string, currency: string): string {
  const precision = PRECISION[currency]
  if (precision === undefined || !/^-?\d+$/.test(minor)) throw new Error('Unsupported monetary value.')
  const value = BigInt(minor)
  const absolute = value < 0n ? -value : value
  const scale = 10n ** BigInt(precision)
  const whole = (absolute / scale).toLocaleString('en-GH')
  const fraction = precision ? `.${(absolute % scale).toString().padStart(precision, '0')}` : ''
  return `${currency} ${value < 0n ? '-' : ''}${whole}${fraction}`
}

export function moneyLines(amounts: MoneyMap): string[] {
  return Object.entries(amounts).sort(([first], [second]) => first.localeCompare(second)).map(([currency, minor]) => formatMoney(minor, currency))
}
