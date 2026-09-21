import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import AppLink from './AppLink';
import { useAuth } from '../contexts/AuthContext';

type AuthMode = 'login' | 'register' | 'verify';

type Props = {
  open: boolean;
  initialMode?: Exclude<AuthMode, 'verify'>;
  initialError?: string;
  onClose: () => void;
  onAuthenticated?: () => void;
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
};

const errorMessages: Record<string, string> = {
  INVALID_CREDENTIALS: 'E-Mail-Adresse oder Passwort ist nicht korrekt.',
  EMAIL_NOT_VERIFIED: 'Bitte bestätige zuerst deine E-Mail-Adresse.',
  EMAIL_ALREADY_EXISTS: 'Für diese E-Mail-Adresse gibt es bereits ein Konto.',
  PASSWORD_TOO_SHORT: 'Das Passwort muss mindestens 8 Zeichen haben.',
  INVALID_EMAIL: 'Bitte gib eine gültige E-Mail-Adresse ein.',
  VERIFICATION_EMAIL_FAILED: 'Die Bestätigungs-E-Mail konnte nicht versendet werden.',
  GOOGLE_OAUTH_NOT_CONFIGURED: 'Google-Anmeldung ist momentan nicht verfügbar.',
};

function getErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return 'Etwas ist schiefgelaufen. Bitte versuche es erneut.';
  return errorMessages[error.name] || errorMessages[error.message] || 'Etwas ist schiefgelaufen. Bitte versuche es erneut.';
}

export default function AuthModal({ open, initialMode = 'login', initialError = '', onClose, onAuthenticated, returnFocusRef }: Props) {
  const { login, register, startGoogle } = useAuth();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setStatus('');
    setError(initialError);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => firstInputRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      requestAnimationFrame(() => returnFocusRef?.current?.focus());
    };
  }, [initialError, initialMode, onClose, open, returnFocusRef]);

  useEffect(() => {
    if (open && mode !== 'verify') requestAnimationFrame(() => firstInputRef.current?.focus());
  }, [mode, open]);

  if (!open) return null;

  function selectMode(nextMode: Exclude<AuthMode, 'verify'>) {
    setMode(nextMode);
    setStatus('');
    setError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setStatus('');

    if (mode === 'register' && password !== passwordConfirm) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
        onAuthenticated?.();
        onClose();
      } else if (mode === 'register') {
        await register(email, password);
        setMode('verify');
      }
    } catch (requestError) {
      if (requestError instanceof Error && (requestError.name === 'EMAIL_NOT_VERIFIED' || requestError.message === 'EMAIL_NOT_VERIFIED')) setMode('verify');
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  function handleApple() {
    setError('');
    setStatus('Apple-Anmeldung ist als Oberfläche vorbereitet und wird nach dem Backend-Anschluss aktiviert.');
  }

  if (mode === 'verify') {
    return (
      <div className="auth-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
        <section ref={dialogRef} className="auth-modal auth-verification" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
          <header className="auth-modal-header"><img src="/brand/dfbk-logo.svg" alt="DFBK.app" /><button className="auth-modal-close" type="button" onClick={onClose} aria-label="Fenster schließen"><span aria-hidden="true">×</span></button></header>
          <div className="verification-symbol" aria-hidden="true">✉</div>
          <h2 id="auth-modal-title">Bestätige deine E-Mail-Adresse</h2>
          <p>Wir haben dir eine E-Mail mit einem Bestätigungslink geschickt.</p>
          <strong className="verification-email">{email}</strong>
          {error && <p className="auth-error" role="alert">{error}</p>}
          {status && <p className="auth-demo-message" role="status">{status}</p>}
          <button className="button auth-submit" type="button" onClick={() => setStatus('Die erneute Zustellung wird mit einem separaten Backend-Endpunkt verbunden.')}>E-Mail erneut senden</button>
          <button className="text-button" type="button" onClick={() => selectMode('register')}>E-Mail-Adresse korrigieren</button>
          <button className="text-button" type="button" onClick={() => selectMode('login')}>Zurück zur Anmeldung</button>
        </section>
      </div>
    );
  }

  return (
    <div className="auth-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section ref={dialogRef} className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
        <header className="auth-modal-header"><img src="/brand/dfbk-logo.svg" alt="DFBK.app" /><button className="auth-modal-close" type="button" onClick={onClose} aria-label="Fenster schließen"><span aria-hidden="true">×</span></button></header>
        <div className="auth-modal-tabs" role="tablist" aria-label="Konto-Zugang wählen"><button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'is-active' : ''} onClick={() => selectMode('login')}>Anmelden</button><button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'is-active' : ''} onClick={() => selectMode('register')}>Registrieren</button></div>
        <div className="auth-modal-intro"><span className="eyebrow">DFBK.app Konto</span><h2 id="auth-modal-title">{mode === 'login' ? 'Willkommen zurück' : 'Konto erstellen'}</h2><p>{mode === 'login' ? 'Melde dich an und arbeite direkt an deinen Projekten weiter.' : 'Starte kostenlos und mache deine Arbeit Schritt für Schritt sichtbar.'}</p></div>
        <div className="auth-provider-grid">
          <button type="button" className="auth-provider" onClick={startGoogle}><span className="auth-provider-icon auth-provider-google" aria-hidden="true">G</span>Mit Google fortfahren</button>
          <button type="button" className="auth-provider" onClick={handleApple}><svg className="auth-provider-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M17.1 12.7c0-2.4 2-3.6 2.1-3.7a4.6 4.6 0 0 0-3.7-2c-1.6-.2-3.1.9-3.9.9-.8 0-2-1-3.3-1-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.8 1.3 10.4.9 1.3 2 2.8 3.4 2.7 1.3-.1 1.8-.9 3.4-.9 1.6 0 2 .9 3.4.9 1.4 0 2.3-1.3 3.2-2.6 1-1.5 1.5-3 1.5-3.1-.1 0-3.3-1.3-3.3-4.1ZM14.5 5.4c.7-.9 1.2-2.1 1.1-3.3-1.1 0-2.4.7-3.2 1.6-.7.8-1.3 2-1.1 3.2 1.2.1 2.5-.6 3.2-1.5Z" /></svg>Mit Apple fortfahren</button>
        </div>
        <div className="auth-divider"><span>oder</span></div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>E-Mail-Adresse<input ref={firstInputRef} type="email" name="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@betrieb.de" required /></label>
          <label><span className="auth-label-row">Passwort{mode === 'login' && <AppLink to="/forgot-password" onClick={onClose}>Passwort vergessen?</AppLink>}</span><input type="password" name="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} placeholder="Mindestens 8 Zeichen" minLength={8} required /></label>
          {mode === 'register' && <label>Passwort bestätigen<input type="password" autoComplete="new-password" value={passwordConfirm} onChange={event => setPasswordConfirm(event.target.value)} placeholder="Passwort wiederholen" minLength={8} required /></label>}
          {mode === 'register' && <label className="auth-consent"><input type="checkbox" required /><span>Ich akzeptiere die <a href="/nutzungsbedingungen">Nutzungsbedingungen</a> und die <a href="/datenschutz">Datenschutzerklärung</a>.</span></label>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          {status && <p className="auth-demo-message" role="status">{status}</p>}
          <button className="button auth-submit" type="submit" disabled={submitting}>{submitting ? 'Einen Moment…' : mode === 'login' ? 'Anmelden' : 'Konto erstellen'}</button>
        </form>
        <p className="auth-switch-copy">{mode === 'login' ? 'Noch kein Konto?' : 'Du hast bereits ein Konto?'} <button type="button" onClick={() => selectMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Registrieren' : 'Anmelden'}</button></p>
      </section>
    </div>
  );
}
