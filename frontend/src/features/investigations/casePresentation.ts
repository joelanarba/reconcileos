import { formatMoney } from '../../lib/money'
import type { Discrepancy, SourceRecord } from '../../types/api'

const guidance: Record<string, { title: string; action: string; uncertainty: string; priority: number }> = {
  missing_payment: { title: 'Payment evidence missing', action: 'Verify the order reference and request payment evidence from the provider or customer.', uncertainty: 'An absent record does not establish whether the customer paid.', priority: 1 },
  currency_mismatch: { title: 'Currencies do not agree', action: 'Verify the original currency on both exports before considering an association.', uncertainty: 'No exchange rate or currency conversion has been assumed.', priority: 2 },
  amount_mismatch: { title: 'Payment exceeds order value', action: 'Check the order total and payment reference against the original records.', uncertainty: 'The difference does not establish an overpayment or a refund obligation.', priority: 3 },
  settlement_discrepancy: { title: 'Settlement values do not agree', action: 'Check the gross amount, currency, fee, and net against the provider settlement statement.', uncertainty: 'These records do not independently confirm a bank receipt.', priority: 4 },
  duplicate_notification: { title: 'Repeated payment reference', action: 'Verify which notifications describe the same provider transaction before approving any relationship.', uncertainty: 'Repeated notifications are not proof of duplicate receipts or fraud.', priority: 5 },
  ambiguous_match: { title: 'Several order matches are possible', action: 'Use the original references and supporting documents to identify the correct order and payment.', uncertainty: 'Equal amounts and references do not distinguish these candidates.', priority: 6 },
  ambiguous_settlement: { title: 'Several settlements share a reference', action: 'Request the provider statement to establish which settlement record applies.', uncertainty: 'No settlement candidate has been selected automatically.', priority: 7 },
  partial_payment: { title: 'Payment below order value', action: 'Check for another payment or an agreed adjustment before documenting the case.', uncertainty: 'Partial payment records are not combined automatically. The difference is not confirmed loss.', priority: 8 },
  fee_discrepancy: { title: 'Settlement fee differs', action: 'Verify the configured fee rule against the applicable provider agreement.', uncertainty: 'A difference from the configured rule does not establish that the provider charged incorrectly.', priority: 9 },
  missing_settlement_evidence: { title: 'Settlement evidence missing', action: 'Check the provider settlement date and obtain the statement for this transaction.', uncertainty: 'Missing settlement evidence does not prove settlement failure.', priority: 10 },
  fee_rule_missing: { title: 'Fee rule needs confirmation', action: 'Obtain the applicable provider and currency fee rule before accepting the settlement.', uncertainty: 'No default fee has been inferred.', priority: 11 },
  unmatched_payment: { title: 'Payment has no accepted order', action: 'Verify the payment reference and compare the proposed order evidence before deciding.', uncertainty: 'A suggested relationship is not an accepted match.', priority: 12 },
  unmatched_settlement: { title: 'Settlement has no eligible payment', action: 'Locate the payment reference and verify the payment status and repeated notifications.', uncertainty: 'This settlement record alone does not establish a reliable payment relationship.', priority: 13 },
  duplicate_import_row: { title: 'Repeated source row', action: 'Check whether the export repeats a row. Keep the original evidence when documenting the result.', uncertainty: 'Repeated source rows do not establish separate financial events.', priority: 14 },
}

export const caseTitle = (type: string) => guidance[type]?.title || type.replaceAll('_', ' ')
export const casePriority = (type: string) => guidance[type]?.priority ?? 99
export const recordReference = (record: SourceRecord) => record.record_type === 'settlement' ? record.settlement_ref || record.id : record.record_type === 'payment' ? record.transaction_ref || record.id : record.order_ref || record.id

export function presentCase(item: Discrepancy) {
  const orders = item.source_records.filter(record => record.record_type === 'order')
  const payments = item.source_records.filter(record => record.record_type === 'payment')
  const settlements = item.source_records.filter(record => record.record_type === 'settlement')
  const order = orders.length === 1 ? orders[0] : undefined
  const payment = payments.length === 1 ? payments[0] : undefined
  const settlement = settlements.length === 1 ? settlements[0] : undefined
  let finding = item.description
  if (order?.expected_minor !== undefined && payment?.amount_minor !== undefined && ['partial_payment', 'amount_mismatch', 'currency_mismatch'].includes(item.type)) {
    finding = `Order ${recordReference(order)} expects ${formatMoney(order.expected_minor, order.currency)}. Payment ${recordReference(payment)} records ${formatMoney(payment.amount_minor, payment.currency)}.`
    if (order.currency === payment.currency) {
      const delta = BigInt(order.expected_minor) - BigInt(payment.amount_minor)
      finding += ` The recorded difference is ${formatMoney((delta < 0n ? -delta : delta).toString(), order.currency)}. No order relationship was accepted for this case.`
    } else finding += ' The currencies differ, so these amounts cannot be compared or automatically matched.'
  } else if (item.type === 'missing_payment' && order?.expected_minor !== undefined) {
    finding = `Order ${recordReference(order)} expects ${formatMoney(order.expected_minor, order.currency)}. No successful payment with this order reference is present in this snapshot.`
  } else if (item.type === 'missing_settlement_evidence' && payment?.amount_minor !== undefined) {
    finding = `${payment.provider || 'The provider'} payment ${recordReference(payment)} records ${formatMoney(payment.amount_minor, payment.currency)}. No settlement record identifies this provider and transaction reference in the snapshot.`
  } else if (item.type === 'fee_discrepancy' && settlement?.fee_minor !== undefined) {
    const expected = item.evidence.details?.expected_fee_minor
    finding = `Settlement ${recordReference(settlement)} records a fee of ${formatMoney(settlement.fee_minor, settlement.currency)}.`
    if (typeof expected === 'string' || typeof expected === 'number') finding += ` The snapshot's configured rule expects ${formatMoney(String(expected), settlement.currency)}.`
    finding += ' The recorded amounts remain unchanged.'
  } else if (item.type === 'partial_payment' && order?.expected_minor !== undefined) {
    finding = `Order ${recordReference(order)} expects ${formatMoney(order.expected_minor, order.currency)}. ${payments.length} related payment records are below that amount. Each record requires review; no combined payment relationship was accepted automatically.`
  } else if (item.type === 'duplicate_notification' && payments.length) {
    finding = `${payments.length} payment notifications share ${payments[0].provider || 'the provider'} transaction reference ${recordReference(payments[0])}. Every member of this reference group was excluded from automatic allocation.`
  } else if (item.type === 'duplicate_import_row') {
    finding = `${item.source_records.length} identical ${item.source_records[0]?.record_type || 'source'} rows were retained in the snapshot. Inspect the original row numbers before documenting whether they describe the same event.`
  } else if (item.type === 'ambiguous_match') {
    finding = `${orders.length} order ${orders.length === 1 ? 'record' : 'records'} and ${payments.length} payment ${payments.length === 1 ? 'record' : 'records'} share the exact reference, currency, and amount grouping. The records do not identify one unique order-payment pair, so no automatic relationship was selected.`
  } else if (item.type === 'ambiguous_settlement' && payment) {
    finding = `${settlements.length} settlement records identify ${payment.provider || 'the provider'} transaction ${recordReference(payment)}. No settlement was selected automatically.`
  } else if (item.type === 'unmatched_payment' && payment?.amount_minor !== undefined) {
    finding = `Payment ${recordReference(payment)} records ${formatMoney(payment.amount_minor, payment.currency)}. No automatic order relationship was accepted. ${orders.length ? `${orders.length} related order ${orders.length === 1 ? 'record is' : 'records are'} available for investigation.` : 'No order candidate is present in this case evidence.'}`
  } else if (item.type === 'fee_rule_missing' && settlement) {
    finding = `Settlement ${recordReference(settlement)} has no configured fee rule for ${settlement.provider || 'its provider'} and ${settlement.currency} in this snapshot. Its fee cannot be verified for an exact settlement match.`
  } else if (item.type === 'unmatched_settlement' && settlement?.gross_minor !== undefined) {
    finding = `Settlement ${recordReference(settlement)} records gross ${formatMoney(settlement.gross_minor, settlement.currency)}${settlement.payment_ref ? ` against payment reference ${settlement.payment_ref}` : ' without a payment reference'}. No reliable eligible payment relationship was accepted.`
  } else if (item.type === 'settlement_discrepancy' && payment?.amount_minor !== undefined && settlement?.gross_minor !== undefined) {
    finding = `Payment ${recordReference(payment)} records ${formatMoney(payment.amount_minor, payment.currency)}. Settlement ${recordReference(settlement)} records gross ${formatMoney(settlement.gross_minor, settlement.currency)}.`
    if (payment.currency !== settlement.currency) finding += ' The currencies differ.'
    else if (payment.amount_minor !== settlement.gross_minor) finding += ' The gross amount differs from the payment.'
    if (settlement.fee_minor !== undefined && settlement.net_minor !== undefined) {
      const expectedNet = BigInt(settlement.gross_minor) - BigInt(settlement.fee_minor)
      if (expectedNet !== BigInt(settlement.net_minor)) finding += ` Recorded net ${formatMoney(settlement.net_minor, settlement.currency)} does not equal gross minus fee (${formatMoney(expectedNet.toString(), settlement.currency)}).`
    }
  }
  const focal = order || payment || settlement
  const value = focal?.expected_minor ?? focal?.amount_minor ?? focal?.gross_minor
  return {
    title: caseTitle(item.type), finding,
    nextStep: guidance[item.type]?.action || 'Review the supporting records and document the evidence for your decision.',
    uncertainty: guidance[item.type]?.uncertainty || 'The rule identifies a difference in recorded evidence; it does not establish financial loss.',
    reference: focal ? recordReference(focal) : `${item.source_records.length} supporting records`,
    value: focal && value !== undefined ? formatMoney(value, focal.currency) : null,
    valueLabel: focal?.record_type === 'order' ? 'Expected order value' : focal?.record_type === 'payment' ? 'Recorded payment value' : 'Recorded settlement gross',
  }
}
