import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AUTH_EVENT, finishSignIn, hostedAuth, session, signInWithPassword, startSignIn, VerificationRequired } from '../../lib/auth'
import { LoginPage } from '../public/LoginPage'

export function AuthGate({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [current, setCurrent] = useState(session)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const [verification, setVerification] = useState(false)
  useEffect(() => {
    if (!hostedAuth) return
    const update = () => { const value = session(); setCurrent(value); if (!value) queryClient.clear() }
    window.addEventListener(AUTH_EVENT, update)
    const expiry = current ? window.setTimeout(update, Math.max(1, current.expires_at - Date.now() - 30000)) : undefined
    return () => { window.removeEventListener(AUTH_EVENT, update); if (expiry) clearTimeout(expiry) }
  }, [current?.expires_at, queryClient])
  useEffect(() => {
    if (!hostedAuth || location.pathname !== '/auth/callback') return
    setBusy(true)
    finishSignIn(location.search).then(path => { setCurrent(session()); navigate(path, { replace: true }) }).catch(setError).finally(() => setBusy(false))
  }, [location.pathname, location.search, navigate])
  async function submit(username: string, password: string) {
    setError(null); setBusy(true); setVerification(false)
    try {
      await signInWithPassword(username, password)
      setCurrent(session())
      if (location.pathname === '/login' || location.pathname === '/auth/callback') navigate('/dashboard', { replace: true })
    } catch (failure) { setError(failure); setVerification(failure instanceof VerificationRequired) }
    finally { setBusy(false) }
  }
  async function provider() { setError(null); try { await startSignIn() } catch (failure) { setError(failure) } }
  if (!hostedAuth || current && location.pathname !== '/auth/callback') return children
  return <LoginPage onSubmit={submit} onProviderSignIn={provider} busy={busy} error={error} verificationRequired={verification} />
}
