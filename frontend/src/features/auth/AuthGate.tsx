import { useQueryClient } from '@tanstack/react-query'
import { CheckCheck, LockKeyhole } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AUTH_EVENT, finishSignIn, hostedAuth, session, startSignIn } from '../../lib/auth'
import { ErrorMessage, Loading } from '../../components/common'

export function AuthGate({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [current, setCurrent] = useState(session)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
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
  if (!hostedAuth) return children
  if (current && location.pathname !== '/auth/callback') return children
  return <main className="auth-screen"><section className="panel auth-panel"><div className="auth-brand"><CheckCheck size={24} /><strong>ReconcileOS</strong></div><h1>Sign in to your workspace</h1><p>Access is restricted to approved finance operators.</p><ErrorMessage error={error} />{busy ? <Loading /> : <button className="button primary" onClick={() => { setError(null); startSignIn().catch(setError) }}><LockKeyhole size={16} />Sign in with Amazon Cognito</button>}<p className="footnote">Your administrator must grant your account workspace access. Financial records are available after authentication.</p></section></main>
}
