import { useQuery } from '@tanstack/react-query'
import { FileSearch, ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../lib/api'
import type { Batch, Page } from '../../types/api'
import { Badge, displayTime, ErrorMessage, Loading, Pagination } from '../../components/common'

export function DemoImportsPage() {
  const [params, setParams] = useSearchParams()
  const batchId = params.get('batch') || ''
  const [page, setPage] = useState(1)
  const history = useQuery({ queryKey: ['imports'], queryFn: () => api<Page<Batch>>('/imports') })
  const preview = useQuery({ queryKey: ['batch', batchId, page], enabled: !!batchId, queryFn: () => api<Batch>(`/imports/${batchId}?page=${page}`) })
  return <>
    <div className="page-heading"><div><div className="eyebrow">SOURCE RECORDS</div><h1>Imported evidence</h1><p>Inspect the synthetic files used to calculate this demonstration.</p></div><Link className="button primary" to="/demo/reconciliation">View reconciliation<ArrowRight size={16} /></Link></div>
    <div className="scope-note">This public demo is read-only. <Link className="text-link" to="/login">Sign in to import CSV or Excel files into your own workspace.</Link></div>
    <ErrorMessage error={history.error || preview.error} />
    {history.isLoading && <Loading />}
    <section className="panel"><div className="panel-heading"><h2>Source files</h2><span className="muted">Entirely synthetic records</span></div><div className="table-scroll"><table><thead><tr><th>File</th><th>Record type</th><th>Rows</th><th>Status</th><th>Imported</th><th>Action</th></tr></thead><tbody>{history.data?.items.map(batch => <tr key={batch.id}><td className="reference">{batch.filename}</td><td>{batch.source_type}</td><td>{batch.valid_rows}</td><td><Badge value={batch.status} /></td><td>{displayTime(batch.created_at)}</td><td><button className="text-link" onClick={() => { setParams({ batch: batch.id }); setPage(1) }}><FileSearch size={15} />Inspect rows</button></td></tr>)}</tbody></table></div></section>
    {preview.isLoading && <Loading />}
    {preview.data && <section className="panel"><div className="panel-heading"><h2>{preview.data.filename}</h2><span className="muted">Original source values</span></div><div className="table-scroll"><table><thead><tr><th>Source row</th>{preview.data.preview.columns.map(column => <th key={column}>{column.replaceAll('_', ' ')}</th>)}</tr></thead><tbody>{preview.data.preview.items.map(row => <tr key={row.source_row}><td>{row.source_row}</td>{preview.data!.preview.columns.map(column => <td key={column}>{row.raw[column] || ''}</td>)}</tr>)}</tbody></table></div><Pagination page={page} total={preview.data.total_rows} onChange={setPage} /><p className="footnote case-content">File checksum: <code>{preview.data.checksum}</code>. Source rows remain unchanged after reconciliation.</p></section>}
  </>
}
