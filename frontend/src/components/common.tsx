import { AlertCircle, ArrowLeft, ArrowRight, Inbox, LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import type { MoneyMap } from '../types/api'
import { moneyLines } from '../lib/money'

export function ErrorMessage({ error }: { error: unknown }) {
  if (!error) return null
  return <div className="alert error" role="alert"><AlertCircle size={17} /><span>{error instanceof Error ? error.message : 'The operation could not be completed.'}</span></div>
}

export function Loading() {
  return <div className="loading" role="status"><LoaderCircle size={18} className="spinner" />Loading records...</div>
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return <div className="empty-state"><Inbox size={28} strokeWidth={1.5} /><h3>{title}</h3><p>{children}</p></div>
}

export function Badge({ value }: { value: string }) {
  return <span className={`badge ${value}`}>{value === 'invalid' ? 'Needs attention' : value.replaceAll('_', ' ')}</span>
}

export function Money({ amounts }: { amounts: MoneyMap }) {
  const lines = moneyLines(amounts)
  return <>{lines.length ? lines.map(line => <span className="money-line" key={line}>{line}</span>) : <span className="muted">No value</span>}</>
}

export function Pagination({ page, total, pageSize = 25, onChange }: { page: number; total: number; pageSize?: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages === 1) return <div className="table-footer">{total} {total === 1 ? 'record' : 'records'}</div>
  return <div className="table-footer"><span>Page {page} of {pages} · {total} records</span><div className="button-group"><button className="button secondary compact" disabled={page === 1} onClick={() => onChange(page - 1)}><ArrowLeft size={14} />Previous</button><button className="button secondary compact" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next<ArrowRight size={14} /></button></div></div>
}

export function displayTime(value: string) {
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}
