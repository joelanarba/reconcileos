import { demoLocation } from '../lib/api'
import { X, ArrowUpRight } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { Discrepancy, Match } from '../types/api'
import { Badge } from './common'
import { EvidenceComparison } from './EvidenceComparison'
import { caseTitle, presentCase } from '../features/investigations/casePresentation'

export function EvidenceDialog({ item, onClose }: { item: Match | Discrepancy; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    dialog.current?.showModal()
    return () => dialog.current?.close()
  }, [])
  return <dialog ref={dialog} className="evidence-dialog" onCancel={onClose} aria-labelledby="evidence-title">
    <header className="dialog-header"><h2 id="evidence-title">{'type' in item ? caseTitle(item.type) : item.kind === 'order_payment' ? 'Order and payment match' : 'Payment and settlement match'}</h2><button className="icon-button" onClick={onClose} aria-label="Close evidence"><X size={20} /></button></header>
    <div className="dialog-content">
      <div className="rule-box"><h3>{'type' in item ? 'What the records show' : 'Decision rule'}</h3><p>{'type' in item ? presentCase(item).finding : item.evidence.rule}</p></div>
      {'status' in item && <div className="inline-meta"><Badge value={item.status} /><Badge value={item.severity} /><span>Run {item.run_id.slice(0, 8)}</span></div>}
      {'type' in item && <p><Link className="button primary" to={`${demoLocation() ? '/demo' : ''}/investigations?run=${item.run_id}&case=${item.id}`} onClick={onClose}>Open investigation<ArrowUpRight size={14} /></Link></p>}
      <h3 className="section-label">Supporting records <span>{item.source_records.length}</span></h3>
      <EvidenceComparison records={item.source_records} demo={demoLocation()} />
      <p className="footnote">Imported records remain unchanged. Decisions shown apply only to this run's input snapshot.</p>
    </div>
  </dialog>
}
