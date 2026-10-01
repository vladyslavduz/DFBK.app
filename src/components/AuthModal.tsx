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

function GoogleIcon() {
  return (
    <svg className="auth-v2-provider-icon" aria-hidden="true" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.3Z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.9-1.8-5.7-4.2H3v2.6A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.3 13.9A6 6 0 0 1 6 12c0-.7.1-1.3.3-1.9V7.5H3A10 10 0 0 0 2 12c0 1.6.4 3.1 1 4.5l3.3-2.6Z" />
      <path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.9 1.5l2.9-2.9A9.8 9.8 0 0 0 12 2 10 10 0 0 0 3 7.5l3.3 2.6C7.1 7.7 9.4 5.9 12 5.9Z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="auth-v2-provider-icon" aria-hidden="true" viewBox="0 0 24 24">
      <path d="M17.1 12.7c0-2.4 2-3.6 2.1-3.7a4.6 4.6 0 0 0-3.7-2c-1.6-.2-3.1.9-3.9.9-.8 0-2-1-3.3-1-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.8 1.3 10.4.9 1.3 2 2.8 3.4 2.7 1.3-.1 1.8-.9 3.4-.9 1.6 0 2 .9 3.4.9 1.4 0 2.3-1.3 3.2-2.6 1-1.5 1.5-3 1.5-3.1-.1 0-3.3-1.3-3.3-4.1ZM14.5 5.4c.7-.9 1.2-2.1 1.1-3.3-1.1 0-2.4.7-3.2 1.6-.7.8-1.3 2-1.1 3.2 1.2.1 2.5-.6 3.2-1.5Z" />
    </svg>
  );
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
    setStatus('Apple-Anmeldung wird nach dem Backend-Anschluss aktiviert.');
  }

  if (mode === 'verify') {
    return (
      <div className="auth-modal-backdrop auth-v2-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
        <section ref={dialogRef} className="auth-modal auth-v2 auth-v2-verify" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
          <header className="auth-v2-header">
            <img src="/brand/dfbk-logo.svg" alt="DFBK.app" />
            <button className="auth-v2-close" type="button" onClick={onClose} aria-label="Fenster schließen"><span aria-hidden="true">×</span></button>
          </header>
          <div className="auth-v2-verify-symbol" aria-hidden="true">✉</div>
          <h2 id="auth-modal-title">E-Mail bestätigen</h2>
          <p className="auth-v2-subtitle">Wir haben dir einen Bestätigungslink geschickt.</p>
          <strong className="verification-email">{email}</strong>
          {error && <p className="auth-error" role="alert">{error}</p>}
          {status && <p className="auth-demo-message" role="status">{status}</p>}
          <button className="button auth-v2-submit" type="button" onClick={() => setStatus('Die erneute Zustellung wird mit einem separaten Backend-Endpunkt verbunden.')}>E-Mail erneut senden</button>
          <div className="auth-v2-verify-actions">
            <button className="text-button" type="button" onClick={() => selectMode('register')}>E-Mail ändern</button>
            <button className="text-button" type="button" onClick={() => selectMode('login')}>Zur Anmeldung</button>
          </div>
        </section>
      </div>
    );
  }

  const isLogin = mode === 'login';

  return (
    <div className="auth-modal-backdrop auth-v2-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section ref={dialogRef} className={`auth-modal auth-v2 ${isLogin ? 'auth-v2-login' : 'auth-v2-register'}`} role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
        <header className="auth-v2-header">
          <img src="/brand/dfbk-logo.svg" alt="DFBK.app" />
          <button className="auth-v2-close" type="button" onClick={onClose} aria-label="Fenster schließen"><span aria-hidden="true">×</span></button>
        </header>

        <div className="auth-v2-tabs" role="tablist" aria-label="Konto-Zugang wählen">
          <button type="button" role="tab" aria-selected={isLogin} className={isLogin ? 'is-active' : ''} onClick={() => selectMode('login')}>Anmelden</button>
          <button type="button" role="tab" aria-selected={!isLogin} className={!isLogin ? 'is-active' : ''} onClick={() => selectMode('register')}>Registrieren</button>
        </div>

        <div className="auth-v2-title-block">
          <h2 id="auth-modal-title">{isLogin ? 'Willkommen zurück' : 'Konto erstellen'}</h2>
        </div>

        <div className="auth-v2-provider-grid">
          <button type="button" className="auth-v2-provider auth-v2-provider-google" onClick={startGoogle}>
            <GoogleIcon />
            <span>Google</span>
          </button>
          <button type="button" className="auth-v2-provider auth-v2-provider-apple" onClick={handleApple}>
            <AppleIcon />
            <span>Apple</span>
          </button>
        </div>

        <div className="auth-v2-divider"><span>oder</span></div>

        <form className="auth-v2-form" onSubmit={handleSubmit}>
          <label>
            <span>E-Mail-Adresse</span>
            <input ref={firstInputRef} type="email" name="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@betrieb.de" required />
          </label>

          <label>
            <span className="auth-v2-label-row">
              <span>Passwort</span>
              {isLogin && <AppLink to="/forgot-password" onClick={onClose}>Passwort vergessen?</AppLink>}
            </span>
            <input type="password" name="password" autoComplete={isLogin ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} placeholder="Mindestens 8 Zeichen" minLength={8} required />
          </label>

          {!isLogin && (
            <label>
              <span>Passwort bestätigen</span>
              <input type="password" autoComplete="new-password" value={passwordConfirm} onChange={event => setPasswordConfirm(event.target.value)} placeholder="Passwort wiederholen" minLength={8} required />
            </label>
          )}

          {!isLogin && (
            <label className="auth-v2-consent">
              <input type="checkbox" required />
              <span>Ich akzeptiere <a href="/nutzungsbedingungen">Nutzungsbedingungen</a> &amp; <a href="/datenschutz">Datenschutz</a>.</span>
            </label>
          )}

          {error && <p className="auth-error" role="alert">{error}</p>}
          {status && <p className="auth-demo-message" role="status">{status}</p>}

          <button className="button auth-v2-submit" type="submit" disabled={submitting}>
            {submitting ? 'Einen Moment…' : isLogin ? 'Anmelden' : 'Konto erstellen'}
          </button>
        </form>
      </section>
    </div>
  );
}
