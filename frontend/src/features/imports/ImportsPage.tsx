import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Download, FileText, Upload, ArrowRight, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, API_BASE } from '../../lib/api'
import type { Batch, ImportOptions, Page, PreviewRow, SourceType, Workspace } from '../../types/api'
import { Badge, displayTime, EmptyState, ErrorMessage, Loading, Pagination } from '../../components/common'
import { formatMoney, PRECISION } from '../../lib/money'
import { ImportMapping, RowCorrection } from './ImportMapping'

export function ImportsPage({ workspace }: { workspace?: Workspace } = {}) {
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [source, setSource] = useState<SourceType>('orders')
  const [file, setFile] = useState<File | null>(null)
  const [notice, setNotice] = useState('')
  const [page, setPage] = useState(1)
  const [historyPage, setHistoryPage] = useState(1)
  const [invalidOnly, setInvalidOnly] = useState(false)
  const [editing, setEditing] = useState<PreviewRow | null>(null)
  const uploadLimit = workspace?.max_upload_bytes || 10485760
  const batchId = params.get('batch') || ''
  const history = useQuery({ queryKey: ['imports', historyPage], queryFn: () => api<Page<Batch>>(`/imports?page=${historyPage}`) })
  const preview = useQuery({ queryKey: ['batch', batchId, page, invalidOnly], enabled: !!batchId, queryFn: () => api<Batch>(`/imports/${batchId}?page=${page}&invalid_only=${invalidOnly}`) })
  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Select a CSV or Excel file first.')
      if (file.size > uploadLimit) throw new Error('The file exceeds the configured upload limit.')
      return api<Batch>(`/imports/preview?source_type=${source}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': encodeURIComponent(file.name) }, body: file })
    },
    onSuccess: batch => {
      setPage(1); setInvalidOnly(false); setParams({ batch: batch.id }); setNotice(batch.status === 'confirmed' ? 'This file was already imported. Existing records are shown.' : '')
      queryClient.invalidateQueries({ queryKey: ['imports'] })
      queryClient.invalidateQueries({ queryKey: ['batch', batch.id] })
    },
  })
  const confirm = useMutation({
    mutationFn: () => api<Batch>(`/imports/${batchId}/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expected_revision: preview.data?.import_info?.revision }) }),
    onSuccess: batch => {
      setNotice(`${batch.valid_rows} ${batch.valid_rows === 1 ? 'record' : 'records'} imported. Source values and provenance are preserved.`)
      queryClient.invalidateQueries({ queryKey: ['batch', batchId] })
      queryClient.invalidateQueries({ queryKey: ['imports'] })
      queryClient.invalidateQueries({ queryKey: ['workspace'] })
      queryClient.invalidateQueries({ queryKey: ['runs'] })
    },
  })
  const mapping = useMutation({
    mutationFn: (options: ImportOptions) => api<Batch>(`/imports/${batchId}/mapping`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options) }),
    onSuccess: result => {
      setPage(1); setInvalidOnly(false); setEditing(null); setNotice('Preview updated. Review the interpreted values before confirming.')
      queryClient.setQueryData(['batch', batchId, 1, false], result)
      queryClient.invalidateQueries({ queryKey: ['batch', batchId] })
      queryClient.invalidateQueries({ queryKey: ['imports'] })
    },
  })
  function selectBatch(id: string) { setParams({ batch: id }); setPage(1); setInvalidOnly(false); confirm.reset(); upload.reset(); setNotice('') }
  const batch = preview.data

  return <>
    <div className="page-heading"><div><div className="eyebrow">RECORD MANAGEMENT</div><h1>Imports</h1><p>Bring in records from your existing CSV and Excel exports.</p></div><Link className="button secondary" to="/reconciliation">Reconciliation<ArrowRight size={15} /></Link></div>
    {notice && <div className="alert success" role="status"><CheckCircle2 size={17} />{notice}</div>}
    <div className="import-grid"><section className="panel"><div className="panel-heading"><h2>Upload records</h2><span className="muted">CSV · Excel</span></div>
      <form className="upload-form" onSubmit={event => { event.preventDefault(); setNotice(''); confirm.reset(); upload.mutate() }}>
        <label htmlFor="source-type">Record type</label><select id="source-type" value={source} onChange={event => setSource(event.target.value as SourceType)}><option value="orders">Orders</option><option value="payments">Payment transactions</option><option value="settlements">Settlement records</option></select>
        <div className="file-area"><Upload size={23} strokeWidth={1.5} /><label htmlFor="csv-file">Select a file</label><p>CSV, TSV, XLSX, or XLS. We recognize common export formats and column names.</p><input id="csv-file" type="file" accept=".csv,.tsv,.txt,.xlsx,.xls,.xlsm" onChange={event => { setFile(event.target.files?.[0] || null); upload.reset() }} /><p>Up to {(uploadLimit / 1048576).toLocaleString('en-GB', { maximumFractionDigits: 1 })} MiB and 10,000 transaction rows.</p></div>
        <ErrorMessage error={upload.error} /><div className="form-footer"><span className="muted">Nothing is imported until you confirm.</span><button className="button primary" type="submit" disabled={!file || upload.isPending}><Upload size={15} />{upload.isPending ? 'Validating...' : 'Preview file'}</button></div>
      </form></section>
      <aside className="panel import-guide"><div className="guide-icon"><FileText size={20} /></div><h2>Use your existing export</h2><p>You do not need to rename columns or convert an Excel file. We suggest the matches; you can adjust them in the preview.</p><a className="button secondary full-width" href={`${API_BASE}/templates/${source}`}><Download size={15} />Download {source} template</a><hr /><h3>Before you confirm</h3><ul className="checklist"><li><Check size={14} />Check recognized column matches.</li><li><Check size={14} />Review rows needing attention.</li><li><Check size={14} />Confirm the interpreted values.</li></ul><p className="footnote">Templates are optional. Original source cells and interpretation choices are retained.</p></aside></div>
    {batchId && <section className="panel preview-panel"><div className="panel-heading"><div><h2>Import preview</h2><p>{batch?.filename || 'Loading selected file'}</p></div>{batch && <Badge value={batch.status} />}</div>
      <ErrorMessage error={preview.error} />{preview.isLoading && <Loading />}
      {batch && <>
        {batch.import_info && <div className="import-detection"><strong>{batch.import_info.format} file recognized{batch.import_info.format.startsWith('Excel') ? ` · ${batch.import_info.sheet}` : ''}</strong><span>{batch.import_info.transformed_rows} rows interpreted from source formatting. Original values are unchanged.</span><span>Blank currency cells use {batch.import_info.options.default_currency}. Amounts use {batch.import_info.options.amount_unit === 'minor' ? 'minor units' : 'currency units'}. Local dates use {batch.import_info.options.timezone}; {batch.import_info.options.date_order === 'DMY' ? 'day/month/year' : 'month/day/year'}.</span></div>}
        {batch.import_info && batch.status !== 'confirmed' && <ImportMapping key={`${batch.id}:${batch.import_info.revision}`} batch={batch} onApply={options => mapping.mutate(options)} pending={mapping.isPending} error={mapping.error} />}
        <div className="preview-summary"><div><span>Rows in file</span><strong>{batch.total_rows}</strong></div><div><span>Ready to import</span><strong className="positive">{batch.valid_rows}</strong></div><div><span>Need attention</span><strong className={batch.invalid_rows ? 'warning-text' : ''}>{batch.invalid_rows}</strong></div>{!!batch.import_info?.excluded_rows && <div><span>Excluded</span><strong>{batch.import_info.excluded_rows}</strong></div>}<label className="checkbox-label"><input type="checkbox" checked={invalidOnly} onChange={event => { setInvalidOnly(event.target.checked); setPage(1) }} />Show rows needing attention</label></div>
        <div className="table-scroll"><table><thead><tr><th>Row</th>{batch.preview.columns.map(column => <th key={column}>{column}</th>)}<th>Interpretation and review</th></tr></thead><tbody>{batch.preview.items.map(row => <tr key={row.source_row}><td className="muted">{row.source_row}</td>{batch.preview.columns.map(column => <td key={column} className="source-cell">{row.raw[column] || <span className="muted">Empty</span>}</td>)}<td className="validation-cell">{row.excluded ? <Badge value="excluded" /> : row.errors.length ? row.errors.map((error, index) => <p className="warning-text" key={index}>{batch.import_info?.fields.find(field => field.key === error.field)?.label || error.field}: {error.message}</p>) : <Badge value="valid" />}{row.warnings.map(warning => <p className="warning-text" key={warning}>{warning}</p>)}
          {row.parsed.currency && PRECISION[row.parsed.currency] !== undefined && (row.parsed.expected_minor || row.parsed.amount_minor) && <p className="interpreted-amount">{formatMoney(row.parsed.expected_minor || row.parsed.amount_minor || '0', row.parsed.currency)}</p>}
          {row.values && <details className="row-interpretation"><summary>Interpreted values</summary><dl>{batch.import_info?.fields.map(field => <div key={field.key}><dt>{field.label}</dt><dd>{row.values?.[field.key] || '(not provided)'}</dd></div>)}</dl>{row.transformations?.map((change, index) => <p key={index}>{change}</p>)}</details>}
          {batch.import_info && batch.status !== 'confirmed' && <button className="text-link row-review-link" onClick={() => { mapping.reset(); setEditing(row) }}>Review row {row.source_row}</button>}
        </td></tr>)}</tbody></table>{!batch.preview.items.length && <div className="inline-empty">No rows in this view.</div>}</div>
        <Pagination page={page} total={batch.preview.total} onChange={setPage} />
        <div className="confirm-bar"><div>{batch.status === 'confirmed' ? <><strong>Import confirmed</strong><p>This file's records are available for reconciliation.</p></> : batch.invalid_rows ? <><strong className="warning-text">{batch.invalid_rows} {batch.invalid_rows === 1 ? 'row needs' : 'rows need'} attention before confirmation.</strong><p>Adjust the mapping or review rows here. There is no need to rewrite the file.</p></> : <><strong>{batch.valid_rows ? 'Ready for confirmation' : 'Select records to import'}</strong><p>{batch.valid_rows} interpreted records will be committed together{batch.import_info?.excluded_rows ? `; ${batch.import_info.excluded_rows} explicitly excluded` : ''}.</p></>}</div><button className="button primary" disabled={batch.status !== 'previewed' || batch.invalid_rows > 0 || !batch.valid_rows || confirm.isPending || mapping.isPending} onClick={() => confirm.mutate()}><Check size={16} />{confirm.isPending ? 'Confirming...' : batch.status === 'confirmed' ? 'Imported' : 'Confirm import'}</button></div><ErrorMessage error={confirm.error} />
      </>}
      {editing && batch?.import_info && <RowCorrection batch={batch} row={editing} onApply={options => mapping.mutate(options)} onClose={() => setEditing(null)} pending={mapping.isPending} error={mapping.error} />}
    </section>}
    <section className="panel"><div className="panel-heading"><div><h2>Import history</h2><p>Validated previews and confirmed files for this workspace.</p></div><span className="count-label">{history.data?.total ?? 0} files</span></div><ErrorMessage error={history.error} />{history.isLoading && <Loading />}
      {history.data && (history.data.items.length ? <><div className="table-scroll"><table><thead><tr><th>File</th><th>Source</th><th>Status</th><th className="number">Rows</th><th className="number">Invalid</th><th>Created</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>{history.data.items.map(item => <tr key={item.id}><td><button className="table-link" onClick={() => selectBatch(item.id)}><FileText size={15} />{item.filename}</button></td><td>{item.source_type}</td><td><Badge value={item.status} /></td><td className="number">{item.total_rows}</td><td className="number">{item.invalid_rows}</td><td className="muted nowrap">{displayTime(item.created_at)}</td><td><button className="text-link" onClick={() => selectBatch(item.id)}>Inspect<ArrowRight size={13} /></button></td></tr>)}</tbody></table></div><Pagination page={historyPage} total={history.data.total} onChange={setHistoryPage} /></> : <EmptyState title="No files imported yet">Start with an order or payment CSV. Validate the preview, then confirm the import.</EmptyState>)}
    </section>
  </>
}
