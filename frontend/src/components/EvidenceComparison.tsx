import { Link } from 'react-router-dom'
import { formatMoney } from '../lib/money'
import type { SourceRecord } from '../types/api'
import { displayTime } from './common'
import { recordReference } from '../features/investigations/casePresentation'

export function EvidenceComparison({ records, demo = false }: { records: SourceRecord[]; demo?: boolean }) {
  return <div className="evidence-comparison">{records.map(record => {
    const timestamp = record.ordered_at || record.paid_at || record.settled_at
    const amounts = [['Expected amount', record.expected_minor], ['Recorded amount', record.amount_minor], ['Gross', record.gross_minor], ['Fee', record.fee_minor], ['Net', record.net_minor]]
    return <article className="evidence-record" key={`${record.record_type}:${record.id}`} id={`record-${record.record_type}-${record.id}`}>
      <h3>{record.record_type === 'order' ? 'Order record' : record.record_type === 'payment' ? 'Payment record' : 'Settlement record'}</h3>
      <strong className="evidence-reference source-identity">{recordReference(record)}</strong>
      <dl>
        {record.provider && <div><dt>Provider</dt><dd>{record.provider}</dd></div>}
        {record.record_type !== 'order' && record.order_ref && <div><dt>Order reference</dt><dd>{record.order_ref}</dd></div>}
        {record.payment_ref && <div><dt>Payment reference</dt><dd>{record.payment_ref}</dd></div>}
        {amounts.filter(([, amount]) => amount !== undefined).map(([label, amount]) => <div key={label} className="evidence-amount"><dt>{label}</dt><dd>{formatMoney(amount!, record.currency)}</dd></div>)}
        <div><dt>Currency</dt><dd>{record.currency}</dd></div>
        {(record.provider_status || record.status) && <div><dt>Recorded status</dt><dd>{record.provider_status || record.status}</dd></div>}
        {timestamp && <div><dt>Timestamp</dt><dd><time dateTime={timestamp}>{displayTime(timestamp)}</time></dd></div>}
      </dl>
      <details><summary>Source and import history</summary>
        <p>{record.source_filename || 'Imported file'} / row {record.source_row}</p>
        <dl className="raw-values">{Object.entries(record.raw).map(([field, value]) => <div key={field}><dt>{field}</dt><dd>{value || '(empty)'}</dd></div>)}</dl>
        {!!record.interpretation?.row_changes.length && <ul className="interpretation-notes">{record.interpretation.row_changes.map((change, index) => <li key={index}>{change}</li>)}</ul>}
        {record.interpretation?.correction_reason && <p>Review reason: {record.interpretation.correction_reason}</p>}
        <Link className="text-link" to={`${demo ? '/demo' : ''}/imports?batch=${record.import_batch_id}`}>Open import provenance</Link>
      </details>
    </article>
  })}</div>
}
