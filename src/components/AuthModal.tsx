import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import AppLink from './AppLink';

type AuthMode = 'login' | 'register';

type Props = {
  open: boolean;
  initialMode?: AuthMode;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
};

export default function AuthModal({ open, initialMode = 'login', onClose, returnFocusRef }: Props) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [demoMessage, setDemoMessage] = useState('');
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    setMode(initialMode);
    setDemoMessage('');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => firstInputRef.current?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      requestAnimationFrame(() => returnFocusRef?.current?.focus());
    };
  }, [initialMode, onClose, open, returnFocusRef]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => firstInputRef.current?.focus());
  }, [mode, open]);

  if (!open) return null;

  function selectMode(nextMode: AuthMode) {
    setMode(nextMode);
    setDemoMessage('');
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDemoMessage(
      mode === 'login'
        ? 'Die Anmeldung wird im nächsten Schritt mit dem bestehenden Backend verbunden.'
        : 'Die Registrierung wird im nächsten Schritt mit dem bestehenden Backend verbunden.'
    );
  }

  function handleProvider(provider: string) {
    setDemoMessage(`${provider}-Anmeldung ist in dieser Designversion noch nicht verbunden.`);
  }

  return (
    <div className="auth-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
        <header className="auth-modal-header">
          <img src="/brand/dfbk-logo.svg" alt="DFBK.app" />
          <button className="auth-modal-close" type="button" onClick={onClose} aria-label="Fenster schließen">
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="auth-modal-tabs" role="tablist" aria-label="Konto-Zugang wählen">
          <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'is-active' : ''} onClick={() => selectMode('login')}>
            Anmelden
          </button>
          <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'is-active' : ''} onClick={() => selectMode('register')}>
            Registrieren
          </button>
        </div>

        <div className="auth-modal-intro">
          <span className="eyebrow">DFBK.app Konto</span>
          <h2 id="auth-modal-title">{mode === 'login' ? 'Willkommen zurück' : 'Konto erstellen'}</h2>
          <p>
            {mode === 'login'
              ? 'Melde dich an und arbeite direkt an deinen Projekten weiter.'
              : 'Starte kostenlos und mache deine Arbeit Schritt für Schritt sichtbar.'}
          </p>
        </div>

        <div className="auth-provider-grid">
          <button type="button" className="auth-provider" onClick={() => handleProvider('Google')}>
            <span className="auth-provider-icon auth-provider-google" aria-hidden="true">G</span>
            Mit Google
          </button>
          <button type="button" className="auth-provider" onClick={() => handleProvider('Apple')}>
            <svg className="auth-provider-icon" aria-hidden="true" viewBox="0 0 24 24">
              <path d="M17.1 12.7c0-2.4 2-3.6 2.1-3.7a4.6 4.6 0 0 0-3.7-2c-1.6-.2-3.1.9-3.9.9-.8 0-2-1-3.3-1-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.8 1.3 10.4.9 1.3 2 2.8 3.4 2.7 1.3-.1 1.8-.9 3.4-.9 1.6 0 2 .9 3.4.9 1.4 0 2.3-1.3 3.2-2.6 1-1.5 1.5-3 1.5-3.1-.1 0-3.3-1.3-3.3-4.1ZM14.5 5.4c.7-.9 1.2-2.1 1.1-3.3-1.1 0-2.4.7-3.2 1.6-.7.8-1.3 2-1.1 3.2 1.2.1 2.5-.6 3.2-1.5Z" />
            </svg>
            Mit Apple
          </button>
        </div>

        <div className="auth-divider"><span>oder mit E-Mail</span></div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <label>
              Name
              <input ref={firstInputRef} name="name" autoComplete="name" placeholder="Max Mustermann" required />
            </label>
          )}
          <label>
            E-Mail-Adresse
            <input ref={mode === 'login' ? firstInputRef : undefined} type="email" name="email" autoComplete="email" placeholder="name@betrieb.de" required />
          </label>
          <label>
            <span className="auth-label-row">
              Passwort
              {mode === 'login' && <AppLink to="/forgot-password" onClick={onClose}>Passwort vergessen?</AppLink>}
            </span>
            <input type="password" name="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="Mindestens 8 Zeichen" minLength={8} required />
          </label>

          {mode === 'register' && (
            <label className="auth-consent">
              <input type="checkbox" required />
              <span>
                Ich akzeptiere die <AppLink to="/agb" onClick={onClose}>AGB</AppLink> und die{' '}
                <AppLink to="/datenschutz" onClick={onClose}>Datenschutzerklärung</AppLink>.
              </span>
            </label>
          )}

          <button className="button auth-submit" type="submit">
            {mode === 'login' ? 'Anmelden' : 'Kostenlos registrieren'}
          </button>
        </form>

        {demoMessage && <p className="auth-demo-message" role="status">{demoMessage}</p>}

        <p className="auth-switch-copy">
          {mode === 'login' ? 'Noch kein Konto?' : 'Du hast bereits ein Konto?'}{' '}
          <button type="button" onClick={() => selectMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Jetzt registrieren' : 'Jetzt anmelden'}
          </button>
        </p>
      </section>
    </div>
  );
}
