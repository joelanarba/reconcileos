import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const state = 'synthetic-state-for-an-authorized-login'
const verifier = 'a'.repeat(64)
const pendingKey = 'reconcileos.auth.pending'
const sessionKey = 'reconcileos.auth.session'

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_AUTH_MODE', 'cognito')
  vi.stubEnv('VITE_API_BASE_URL', '/api')
  vi.stubEnv('VITE_COGNITO_DOMAIN', 'https://reconcileos-test.auth.us-east-1.amazoncognito.com')
  vi.stubEnv('VITE_COGNITO_CLIENT_ID', 'exampleclient')
  sessionStorage.clear()
})

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

function pending(changes: Record<string, unknown> = {}) {
  sessionStorage.setItem(pendingKey, JSON.stringify({ state, verifier, created_at: Date.now(), return_path: '/reports?run=example', ...changes }))
}

it('redeems a matching callback once with PKCE and keeps only a bounded access session', async () => {
  pending()
  const fetchMock = vi.fn(async (_url: string, options: RequestInit) => {
    expect(new URLSearchParams(options.body as string).get('code_verifier')).toBe(verifier)
    expect(new URLSearchParams(options.body as string).get('client_id')).toBe('exampleclient')
    return new Response(JSON.stringify({ access_token: 'synthetic-access-token', refresh_token: 'must-not-be-stored', token_type: 'Bearer', expires_in: 900 }))
  })
  vi.stubGlobal('fetch', fetchMock)
  const auth = await import('../src/lib/auth')
  const search = '?' + new URLSearchParams({ state, code: 'synthetic-code' })
  expect(await Promise.all([auth.finishSignIn(search), auth.finishSignIn(search)])).toEqual(['/reports?run=example', '/reports?run=example'])
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(sessionStorage.getItem(pendingKey)).toBeNull()
  expect(auth.session()?.access_token).toBe('synthetic-access-token')
  expect(sessionStorage.getItem(sessionKey)).not.toContain('must-not-be-stored')
})

it.each([
  { state: 'wrong-state' }, { created_at: Date.now() - 601000 }, { verifier: 'too-short' },
])('rejects mismatched, expired, or malformed sign-in state without a provider request: %j', async changes => {
  pending(changes)
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  const { finishSignIn } = await import('../src/lib/auth')
  await expect(finishSignIn('?' + new URLSearchParams({ state, code: 'synthetic-code' }))).rejects.toThrow('Start sign-in again')
  expect(fetchMock).not.toHaveBeenCalled()
})

it('never sends an API request without a current session', async () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  const { api } = await import('../src/lib/api')
  await expect(api('/workspace')).rejects.toThrow('Your session expired')
  expect(fetchMock).not.toHaveBeenCalled()
})

it('attaches the access token and clears a session rejected by the API', async () => {
  sessionStorage.setItem(sessionKey, JSON.stringify({ access_token: 'synthetic-access-token', expires_at: Date.now() + 900000 }))
  vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit) => {
    expect(url).toBe('/api/workspace')
    expect(new Headers(options.headers).get('Authorization')).toBe('Bearer synthetic-access-token')
    return new Response('{}', { status: 401 })
  }))
  const { api } = await import('../src/lib/api')
  await expect(api('/workspace')).rejects.toThrow('Your session expired')
  expect(sessionStorage.getItem(sessionKey)).toBeNull()
})

it('rejects a cross-origin hosted API configuration before sending tokens', async () => {
  vi.stubEnv('VITE_API_BASE_URL', 'https://other.example/api')
  await expect(import('../src/lib/api')).rejects.toThrow('same-origin')
})

it('signs in through Cognito directly and never stores a password or refresh token', async () => {
  const fetchMock = vi.fn(async (url: string, options: RequestInit) => {
    expect(url).toBe('https://cognito-idp.us-east-1.amazonaws.com/')
    const body = JSON.parse(options.body as string)
    expect(body.AuthFlow).toBe('USER_PASSWORD_AUTH')
    expect(body.AuthParameters).toEqual({ USERNAME: 'operator', PASSWORD: 'synthetic-password' })
    return new Response(JSON.stringify({ AuthenticationResult: { AccessToken: 'synthetic-access-token', TokenType: 'Bearer', ExpiresIn: 900, RefreshToken: 'must-not-be-stored' } }))
  })
  vi.stubGlobal('fetch', fetchMock)
  const auth = await import('../src/lib/auth')
  await auth.signInWithPassword('operator', 'synthetic-password')
  expect(auth.session()?.access_token).toBe('synthetic-access-token')
  expect(sessionStorage.getItem(sessionKey)).not.toMatch(/synthetic-password|must-not-be-stored/)
})

it('requires the provider verification flow when Cognito requests a challenge', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ChallengeName: 'NEW_PASSWORD_REQUIRED' }))))
  const auth = await import('../src/lib/auth')
  await expect(auth.signInWithPassword('operator', 'synthetic-password')).rejects.toBeInstanceOf(auth.VerificationRequired)
  expect(auth.session()).toBeNull()
})

it('keeps public demo requests anonymous even with a signed-in operator session', async () => {
  sessionStorage.setItem(sessionKey, JSON.stringify({ access_token: 'synthetic-access-token', expires_at: Date.now() + 900000 }))
  vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit) => {
    expect(url).toBe('/api/demo/dashboard')
    expect(new Headers(options.headers).has('Authorization')).toBe(false)
    return new Response('{}')
  }))
  const { api } = await import('../src/lib/api')
  await api('/demo/dashboard')
})
