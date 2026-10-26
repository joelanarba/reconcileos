import { hostedAuth, invalidateSession, session } from './auth'

export const API_BASE = (import.meta.env.VITE_API_BASE_URL || (hostedAuth ? '/api' : 'http://127.0.0.1:8000/api')).replace(/\/$/, '')
if (hostedAuth && API_BASE !== '/api') throw new Error('Hosted requests must use the same-origin /api endpoint.')
export const demoLocation = () => window.location.pathname === '/demo' || window.location.pathname.startsWith('/demo/')
export const apiUrl = (path: string) => `${API_BASE}${demoLocation() && !path.startsWith('/demo/') ? '/demo' : ''}${path}`
class ReadOnlyDemoError extends Error {}

async function request(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)
  const demo = demoLocation() || path.startsWith('/demo/')
  if (demo && options.method && !['GET', 'HEAD', 'OPTIONS'].includes(options.method.toUpperCase())) throw new ReadOnlyDemoError('The synthetic demo is read-only. Sign in to work with your own records.')
  if (hostedAuth && !demo) {
    const current = session()
    if (!current) { invalidateSession(); throw new Error('Your session expired. Sign in again.') }
    headers.set('Authorization', 'Bearer ' + current.access_token)
  }
  if (typeof options.body === 'string' && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const response = await fetch(apiUrl(path), { ...options, headers, signal: AbortSignal.timeout(60000) })
  if (hostedAuth && !demo && response.status === 401) { invalidateSession(); throw new Error('Your session expired. Sign in again.') }
  return response
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await request(path, options)
  } catch (error) {
    if (error instanceof ReadOnlyDemoError) throw error
    if (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new Error('The request timed out. Refresh the records before retrying a confirmation or run.')
    }
    if (error instanceof Error && error.message === 'Your session expired. Sign in again.') throw error
    throw new Error(hostedAuth ? 'Cannot reach the application API. Check your connection and try again.' : 'Cannot reach the local API. Check that the backend is running on the configured address.')
  }
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.detail?.message || (typeof data?.detail === 'string' ? data.detail : 'The request could not be completed.'))
  }
  return data as T
}

export async function downloadCsv(path: string, filename: string) {
  const response = await request(path)
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.detail?.message || 'The report could not be downloaded.')
  }
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url; link.download = (demoLocation() ? 'synthetic-demo-' : '') + filename; document.body.append(link); link.click(); link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
