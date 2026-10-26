import { ArrowLeft, ArrowRight, CheckCheck, Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ErrorMessage } from '../../components/common'
import './public.css'

export type LoginPageProps = {
  onSubmit: (username: string, password: string) => Promise<void>
  onProviderSignIn: () => Promise<void>
  busy: boolean
  error: unknown
  verificationRequired?: boolean
}

export function LoginPage({ onSubmit, onProviderSignIn, busy, error, verificationRequired = false }: LoginPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const formId = useId()
  const usernameId = `${formId}-username`
  const passwordId = `${formId}-password`
  const descriptionId = `${formId}-description`
  const errorId = `${formId}-error`

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !username.trim() || !password) return
    await onSubmit(username.trim(), password)
  }

  return (
    <div className="login-page">
      <a className="public-skip-link" href="#login-panel">Skip to sign in</a>
      <header className="login-header public-container">
        <Link className="public-brand" to="/" aria-label="ReconcileOS home"><span className="public-brand-mark"><CheckCheck size={23} aria-hidden="true" /></span><span><strong>ReconcileOS</strong><small>Financial operations</small></span></Link>
        <Link className="public-text-link login-return-home" to="/"><ArrowLeft size={15} aria-hidden="true" />Return home</Link>
      </header>

      <main className="login-main public-container">
        <section className="login-context" aria-labelledby="login-context-title">
          <div><p className="public-kicker">Operator workspace</p><h2 id="login-context-title">Keep the evidence <br />with the work.</h2><p className="login-context-description">Compare your financial records, investigate differences, and document the decisions behind the results.</p></div>
          <div className="login-demo-card"><p className="public-kicker">Public demo</p><h3>Take a look before signing in.</h3><p>Explore synthetic records in a read-only workspace. No account or credentials needed.</p><Link className="public-text-link" to="/demo">Try the demo<ArrowRight size={15} aria-hidden="true" /></Link></div>
        </section>

        <section className="login-panel" id="login-panel" aria-labelledby="login-title" tabIndex={-1}>
          <div className="login-panel-inner">
            <span className="login-lock-mark"><LockKeyhole size={23} strokeWidth={1.6} aria-hidden="true" /></span>
            <p className="public-kicker">Operator access</p>
            <h1 id="login-title">{verificationRequired ? 'Complete account verification' : 'Sign in to ReconcileOS'}</h1>
            <p className="login-description" id={descriptionId}>{verificationRequired ? 'Your account requires an additional verification step before you can enter the workspace.' : 'Use the username and password provided by your workspace administrator.'}</p>

            {Boolean(error) && <div className="login-error" id={errorId}><ErrorMessage error={error} /></div>}

            {verificationRequired ? (
              <div className="login-verification" aria-busy={busy}>
                <p>Continue to the secure sign-in service to complete the required step. You may be asked to verify your account or update a temporary password.</p>
                <button className="public-button public-button-primary login-submit" type="button" disabled={busy} onClick={onProviderSignIn} aria-describedby={`${descriptionId}${error ? ` ${errorId}` : ''}`}>
                  {busy ? <><LoaderCircle className="login-loading-icon" size={16} aria-hidden="true" />Continuing...</> : <>Continue to secure verification<ArrowRight size={16} aria-hidden="true" /></>}
                </button>
              </div>
            ) : (
              <form className="login-form" onSubmit={handleSubmit} aria-busy={busy} aria-describedby={`${descriptionId}${error ? ` ${errorId}` : ''}`}>
                <div className="login-field"><label htmlFor={usernameId}>Username</label><input id={usernameId} name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={event => setUsername(event.target.value)} disabled={busy} required /></div>
                <div className="login-field"><label htmlFor={passwordId}>Password</label><div className="login-password-field"><input id={passwordId} name="password" type={passwordVisible ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} disabled={busy} required /><button className="login-password-toggle" type="button" onClick={() => setPasswordVisible(visible => !visible)} aria-label={passwordVisible ? 'Hide password' : 'Show password'} aria-pressed={passwordVisible} aria-controls={passwordId} disabled={busy}>{passwordVisible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button></div></div>
                <button className="public-button public-button-primary login-submit" type="submit" disabled={busy || !username.trim() || !password}>{busy ? <><LoaderCircle className="login-loading-icon" size={16} aria-hidden="true" />Signing in...</> : <>Sign in<ArrowRight size={16} aria-hidden="true" /></>}</button>
              </form>
            )}

            <p className="login-pending-status" role="status" aria-live="polite">{busy ? (verificationRequired ? 'Opening secure verification. Please wait.' : 'Checking your account. Please wait.') : ''}</p>
            <div className="login-access-note"><ShieldCheck size={18} aria-hidden="true" /><div><h2>Access is granted by your administrator.</h2><p>Contact your workspace administrator if you need an account or help signing in. Workspace records are restricted to approved operators.</p></div></div>
            <p className="login-demo-link">Just exploring? <Link to="/demo">Open the public demo<ArrowRight size={13} aria-hidden="true" /></Link></p>
          </div>
        </section>
      </main>

      <footer className="login-footer public-container"><span>ReconcileOS</span><span>Order, payment, and settlement reconciliation.</span></footer>
    </div>
  )
}
