import { useEffect, useRef, useState } from 'react'
import { Settings2, X } from 'lucide-react'
import type { Batch, ImportOptions, PreviewRow } from '../../types/api'
import { ErrorMessage } from '../../components/common'

export function appliedOptions(batch: Batch): ImportOptions {
  const info = batch.import_info!
  return { ...info.options, column_map: info.mapping, sheet: info.sheet, header_row: info.header_row, expected_revision: info.revision }
}

export function ImportMapping({ batch, onApply, pending, error }: { batch: Batch; onApply: (options: ImportOptions) => void; pending: boolean; error: unknown }) {
  const info = batch.import_info!
  const [options, setOptions] = useState<ImportOptions>(() => appliedOptions(batch))
  function change<Key extends keyof ImportOptions>(key: Key, value: ImportOptions[Key]) { setOptions(previous => ({ ...previous, [key]: value })) }
  return <details className="mapping-panel" open={batch.invalid_rows > 0}>
    <summary><Settings2 size={16} /><span>Match your columns and review interpretation</span><small>{Object.values(info.mapping).filter(Boolean).length} columns recognized</small></summary>
    <form onSubmit={event => { event.preventDefault(); onApply(options) }}>
      <p className="mapping-intro">Keep your existing column names. Check the matches below, choose defaults only where needed, and apply them to the preview. Original cells stay unchanged.</p>
      <div className="mapping-grid">
        {info.sheets.length > 1 && <label>Worksheet<select value={options.sheet || ''} onChange={event => setOptions(previous => ({ ...previous, sheet: event.target.value, header_row: null, column_map: {}, corrections: {}, excluded_rows: [] }))}>{info.sheets.map(sheet => <option key={sheet}>{sheet}</option>)}</select></label>}
        <label>Header row<select value={options.header_row ?? ''} onChange={event => setOptions(previous => ({ ...previous, header_row: Number(event.target.value), column_map: {}, corrections: {}, excluded_rows: [] }))}><option value="0">No header row</option>{Array.from({ length: 25 }, (_, position) => position + 1).map(row => <option value={row} key={row}>Row {row}</option>)}</select></label>
        {info.fields.map(field => <label key={field.key}>{field.label}{field.required ? ' *' : ''}<select aria-label={field.label} aria-required={field.required} value={options.column_map[field.key] || ''} onChange={event => change('column_map', { ...options.column_map, [field.key]: event.target.value || null })}><option value="">Not in this file</option>{batch.preview.columns.map(column => <option value={column} key={column}>{column}</option>)}</select></label>)}
      </div>
      <h3>How to read this export</h3>
      <div className="mapping-grid">
        <label>Currency for blank cells<select value={options.default_currency} onChange={event => change('default_currency', event.target.value)}>{['GHS', 'USD', 'EUR', 'GBP', 'JPY', 'KWD'].map(currency => <option key={currency}>{currency}</option>)}</select></label>
        <label>Number format<select value={options.decimal_style} onChange={event => change('decimal_style', event.target.value as ImportOptions['decimal_style'])}><option value="auto">Detect from each value</option><option value="dot">1,234.56</option><option value="comma">1.234,56</option></select></label>
        <label>Amount units<select value={options.amount_unit || 'major'} onChange={event => change('amount_unit', event.target.value as 'major' | 'minor')}><option value="major">Currency units, for example GHS 125.50</option><option value="minor">Minor units, for example 12550 pesewas</option></select></label>
        <label>Date order<select value={options.date_order} onChange={event => change('date_order', event.target.value as ImportOptions['date_order'])}><option value="DMY">Day / month / year</option><option value="MDY">Month / day / year</option></select></label>
        <label>Timezone for local dates<select value={options.timezone} onChange={event => change('timezone', event.target.value)}>{['Africa/Accra', 'UTC', 'Africa/Lagos', 'Africa/Nairobi', 'Europe/London', 'Europe/Paris', 'America/New_York'].map(timezone => <option key={timezone}>{timezone}</option>)}</select></label>
        <label>Statement date for blank dates<input type="date" value={options.default_date} onChange={event => change('default_date', event.target.value)} /></label>
        {batch.source_type !== 'settlements' && <label>Status for blank cells<select value={options.default_status} onChange={event => change('default_status', event.target.value)}><option value="">{batch.source_type === 'orders' ? 'Use open for orders' : 'Require a status in the file'}</option>{info.allowed_statuses.map(status => <option value={status} key={status}>{status}</option>)}</select></label>}
        {batch.source_type !== 'orders' && <label>Provider for blank cells<input value={options.default_provider} placeholder="For example, MTN Mobile Money" onChange={event => change('default_provider', event.target.value)} maxLength={80} /></label>}
      </div>
      {!!info.unknown_statuses.length && <><h3>Unfamiliar status values</h3><p className="footnote">Choose what these source values mean. Payment success is never assumed from an unknown status.</p><div className="mapping-grid">{info.unknown_statuses.filter(Boolean).map(status => <label key={status}>Source status: {status}<select value={options.status_map[status] || ''} onChange={event => change('status_map', { ...options.status_map, [status]: event.target.value })}><option value="">Choose its meaning</option>{info.allowed_statuses.map(meaning => <option value={meaning} key={meaning}>{meaning}</option>)}</select></label>)}</div></>}
      {info.format.startsWith('Excel') && <label className="checkbox-label formula-option"><input type="checkbox" checked={options.allow_cached_formulas} onChange={event => change('allow_cached_formulas', event.target.checked)} />Use stored formula results where available. These values are not recalculated.</label>}
      <ErrorMessage error={error} /><div className="form-footer"><span className="muted">Mapping changes only the unconfirmed interpretation.</span><button className="button secondary" disabled={pending}>{pending ? 'Updating preview...' : 'Apply mapping'}</button></div>
    </form>
  </details>
}

export function RowCorrection({ batch, row, onApply, onClose, pending, error }: { batch: Batch; row: PreviewRow; onApply: (options: ImportOptions) => void; onClose: () => void; pending: boolean; error: unknown }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const base = appliedOptions(batch)
  const [values, setValues] = useState<Record<string, string>>({ ...(row.edit_values || row.values) })
  const [excluded, setExcluded] = useState(!!row.excluded)
  const [reason, setReason] = useState('')
  useEffect(() => { dialog.current?.showModal(); return () => dialog.current?.close() }, [])
  function submit() {
    const changes = Object.fromEntries(Object.entries(values).filter(([field, value]) => value !== (row.edit_values || row.values)?.[field]))
    const corrections = { ...base.corrections, [row.source_row]: { ...base.corrections[String(row.source_row)], ...changes } }
    const excludedRows = [...base.excluded_rows.filter(number => number !== row.source_row), ...(excluded ? [row.source_row] : [])]
    onApply({ ...base, corrections, excluded_rows: excludedRows, reason })
  }
  return <dialog className="evidence-dialog" ref={dialog} onCancel={onClose} aria-labelledby="row-correction-title"><header className="dialog-header"><h2 id="row-correction-title">Review source row {row.source_row}</h2><button className="icon-button" onClick={onClose} aria-label="Close row review"><X size={18} /></button></header>
    <form className="dialog-content" onSubmit={event => { event.preventDefault(); submit() }}>
      <p className="mapping-intro">Original source values are preserved. Corrections and exclusions are recorded with your reason before anything is imported.</p>
      <div className="mapping-grid">{batch.import_info!.fields.map(field => <label key={field.key}>{field.label}<input aria-label={field.label} value={values[field.key] || ''} onChange={event => setValues(previous => ({ ...previous, [field.key]: event.target.value }))} maxLength={2000} />{row.errors.filter(issue => issue.field === field.key).map(issue => <span className="negative field-message" key={issue.message}>{issue.message}</span>)}</label>)}</div>
      <label className="checkbox-label formula-option"><input type="checkbox" checked={excluded} onChange={event => setExcluded(event.target.checked)} />Exclude this row from the confirmed import</label>
      <label className="reason-field">Reason for this review<textarea value={reason} onChange={event => setReason(event.target.value)} required minLength={3} maxLength={2000} placeholder="For example, corrected an export value or excluded a summary row." /></label>
      <ErrorMessage error={error} /><div className="form-footer"><span className="muted">No financial record changes until confirmation.</span><button className="button primary" disabled={pending || reason.trim().length < 3}>{pending ? 'Updating...' : 'Apply row review'}</button></div>
    </form>
  </dialog>
}
