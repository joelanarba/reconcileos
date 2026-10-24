type Session = { access_token: string; expires_at: number }
type Pending = { state: string; verifier: string; created_at: number; return_path: string }
const SESSION_KEY = 'reconcileos.auth.session'
const PENDING_KEY = 'reconcileos.auth.pending'
export const AUTH_EVENT = 'reconcileos-auth-changed'
export const hostedAuth = import.meta.env.VITE_AUTH_MODE === 'cognito'
let callbackPromise: Promise<string> | null = null

function settings() {
  const domain = String(import.meta.env.VITE_COGNITO_DOMAIN || '')
  const clientId = String(import.meta.env.VITE_COGNITO_CLIENT_ID || '')
  const url = new URL(domain)
  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.auth\.[a-z0-9-]+\.amazoncognito\.com$/.test(url.hostname) || url.username || url.password || url.search || url.hash || url.pathname !== '/' || !/^[a-z0-9]{1,128}$/.test(clientId)) throw new Error('The hosted sign-in configuration is invalid.')
  if (window.location.protocol !== 'https:') throw new Error('Hosted sign-in requires HTTPS.')
  return { domain: url.origin, clientId, redirectUri: window.location.origin + '/auth/callback' }
}

function encode(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

export function session(): Session | null {
  if (!hostedAuth) return null
  try {
    const result = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null') as Session | null
    if (result && typeof result.access_token === 'string' && result.access_token.length > 0 && result.access_token.length < 16384 && Number.isFinite(result.expires_at) && result.expires_at > Date.now() + 30000) return result
  } catch { /* An invalid local session is discarded. */ }
  sessionStorage.removeItem(SESSION_KEY)
  return null
}

export function invalidateSession() {
  sessionStorage.removeItem(SESSION_KEY)
  window.dispatchEvent(new Event(AUTH_EVENT))
}

function safeReturnPath(value: string) {
  const url = new URL(value, window.location.origin)
  return url.origin === window.location.origin && url.pathname !== '/auth/callback' ? url.pathname + url.search : '/dashboard'
}

export async function startSignIn() {
  const configuration = settings()
  const verifier = encode(crypto.getRandomValues(new Uint8Array(48)))
  const state = encode(crypto.getRandomValues(new Uint8Array(32)))
  const challenge = encode(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ state, verifier, created_at: Date.now(), return_path: safeReturnPath(window.location.pathname + window.location.search) }))
  const query = new URLSearchParams({ response_type: 'code', client_id: configuration.clientId, redirect_uri: configuration.redirectUri, scope: 'openid aws.cognito.signin.user.admin', state, code_challenge_method: 'S256', code_challenge: challenge })
  window.location.assign(configuration.domain + '/oauth2/authorize?' + query)
}

async function exchangeCode(search: string) {
  const configuration = settings()
  const query = new URLSearchParams(search)
  const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null') as Pending | null
  sessionStorage.removeItem(PENDING_KEY)
  if (query.has('error') || !pending || query.getAll('state').length !== 1 || query.getAll('code').length !== 1 || typeof pending.state !== 'string' || pending.state.length < 32 || pending.state !== query.get('state') || !query.get('code') || !Number.isFinite(pending.created_at) || Date.now() - pending.created_at > 600000 || pending.created_at > Date.now() || !/^[A-Za-z0-9_-]{43,128}$/.test(pending.verifier)) throw new Error('The sign-in request expired or did not match. Start sign-in again.')
  const response = await fetch(configuration.domain + '/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', client_id: configuration.clientId, redirect_uri: configuration.redirectUri, code: query.get('code')!, code_verifier: pending.verifier }), signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error('Sign-in could not be completed. Start sign-in again.')
  const result = await response.json()
  if (typeof result.access_token !== 'string' || !result.access_token || result.access_token.length > 16384 || String(result.token_type).toLowerCase() !== 'bearer' || !Number.isInteger(result.expires_in) || result.expires_in < 60 || result.expires_in > 86400) throw new Error('The identity provider returned an invalid session.')
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: result.access_token, expires_at: Date.now() + result.expires_in * 1000 }))
  window.dispatchEvent(new Event(AUTH_EVENT))
  return safeReturnPath(pending.return_path)
}

export function finishSignIn(search: string) {
  // React StrictMode must not redeem the same one-time authorization code twice.
  callbackPromise ??= exchangeCode(search)
  return callbackPromise
}

export function signOut() {
  const configuration = settings()
  invalidateSession()
  sessionStorage.removeItem(PENDING_KEY)
  window.location.assign(configuration.domain + '/logout?' + new URLSearchParams({ client_id: configuration.clientId, logout_uri: window.location.origin + '/login' }))
}
