import type { CaseDetail } from '../../types/api'
import { displayTime } from '../../components/common'
import { recordReference } from './casePresentation'

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

export function SavedInvestigation({ note, records }: { note: CaseDetail['investigations'][number]; records: CaseDetail['source_records'] }) {
  return <article className="saved-investigation">
    <div className="saved-investigation-heading"><h3>Saved AI investigation</h3><time dateTime={note.created_at}>{displayTime(note.created_at)}</time></div>
    <p className="ai-qualification">Hypothesis for human review. It has not changed financial results.</p>
    <p className="ai-explanation">{note.explanation}</p>
    <h4>Supporting references</h4><ul className="ai-references">{strings(note.evidence.supporting_record_ids).map(id => {
      const record = records.find(record => `${record.record_type}:${record.id}` === id)
      return <li key={id}>{record ? <a className="text-link" href={`#record-${record.record_type}-${record.id}`}>{record.record_type}: {recordReference(record)}</a> : <span>{id}</span>}</li>
    })}</ul>
    {!!strings(note.evidence.alternative_explanations).length && <><h4>Other possibilities</h4><ul>{strings(note.evidence.alternative_explanations).map((text, index) => <li key={index}>{text}</li>)}</ul></>}
    <h4>What remains uncertain</h4><ul>{strings(note.evidence.limitations).map((text, index) => <li key={index}>{text}</li>)}</ul>
    {strings(note.ai_metadata?.context_limitations).map((text, index) => <p key={index} className="footnote">{text}</p>)}
    <h4>Suggested investigation step</h4><p>{note.suggested_action}</p>
    <p className="footnote">Provider: {String(note.ai_metadata?.provider || 'Not recorded')} / Model: {String(note.ai_metadata?.model || 'Not recorded')}. Model confidence: {String(note.evidence.confidence_classification || 'Not recorded')}; this is not a calibrated probability.</p>
  </article>
}
