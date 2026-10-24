import { X, FileText, ArrowUpRight } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { Discrepancy, Match } from '../types/api'
import { formatMoney } from '../lib/money'
import { Badge } from './common'

export function EvidenceDialog({ item, onClose }: { item: Match | Discrepancy; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    dialog.current?.showModal()
    return () => dialog.current?.close()
  }, [])
  return <dialog ref={dialog} className="evidence-dialog" onCancel={onClose} aria-labelledby="evidence-title">
    <header className="dialog-header"><div><div className="eyebrow">SOURCE EVIDENCE</div><h2 id="evidence-title">{'type' in item ? item.type.replaceAll('_', ' ') : item.kind.replaceAll('_', ' ') + ' match'}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close evidence"><X size={20} /></button></header>
    <div className="dialog-content">
      <div className="rule-box"><h3>Decision rule</h3><p>{item.evidence.rule}</p>{'description' in item && item.description !== item.evidence.rule && <p>{item.description}</p>}</div>
      {'status' in item && <div className="inline-meta"><Badge value={item.status} /><Badge value={item.severity} /><span>Run {item.run_id.slice(0, 8)}</span></div>}
      {'type' in item && <p><Link className="button primary" to={`/investigations?run=${item.run_id}&case=${item.id}`} onClick={onClose}>Open investigation<ArrowUpRight size={14} /></Link></p>}
      <h3 className="section-label">Supporting records <span>{item.source_records.length}</span></h3>
      {item.source_records.map(record => <article className="source-card" key={record.id}>
        <div className="source-heading"><span><FileText size={16} />{record.record_type === 'order' ? 'Order' : record.record_type === 'payment' ? 'Payment' : 'Settlement'}</span><Badge value={record.provider_status || record.status || 'recorded'} /></div>
        <div className="source-identity"><strong>{record.transaction_ref || record.order_ref || record.settlement_ref || record.id}</strong><strong>{formatMoney(record.expected_minor || record.amount_minor || record.gross_minor || '0', record.currency)}</strong></div>
        {record.record_type === 'settlement' && <p>Fee {formatMoney(record.fee_minor || '0', record.currency)} / Net {formatMoney(record.net_minor || '0', record.currency)} / Related payment {record.payment_ref || 'No reference supplied'}</p>}
        <p className="muted">{record.provider ? `${record.provider} · ` : ''}{record.source_filename || 'Imported CSV'} · source row {record.source_row}</p>
        <details><summary>Original source values</summary><dl className="raw-values">{Object.entries(record.raw).map(([field, value]) => <div key={field}><dt>{field}</dt><dd>{value || '(empty)'}</dd></div>)}</dl></details>
        {!!record.interpretation?.row_changes.length && <details><summary>Import interpretation</summary><ul className="interpretation-notes">{record.interpretation.row_changes.map((change, index) => <li key={index}>{change}</li>)}</ul>{record.interpretation.correction_reason && <p>Review reason: {record.interpretation.correction_reason}</p>}</details>}
        <Link className="text-link" to={`/imports?batch=${record.import_batch_id}`} onClick={onClose}>Open import provenance<ArrowUpRight size={13} /></Link>
      </article>)}
      <p className="footnote">Imported records remain unchanged. Decisions shown apply only to this run's input snapshot.</p>
    </div>
  </dialog>
}
