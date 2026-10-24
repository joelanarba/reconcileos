export const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api').replace(/\/$/, '')

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, signal: AbortSignal.timeout(60000) })
  } catch (error) {
    if (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new Error('The request timed out. Refresh the records before retrying a confirmation or run.')
    }
    throw new Error('Cannot reach the local API. Check that the backend is running on the configured address.')
  }
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.detail?.message || (typeof data?.detail === 'string' ? data.detail : 'The request could not be completed.'))
  }
  return data as T
}
