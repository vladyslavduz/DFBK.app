import { useCallback, useRef, useState } from 'react';
import AppLink from './AppLink';
import AuthModal from './AuthModal';
import { useAuth } from '../contexts/AuthContext';
import { navigate } from '../lib/router';

export default function Header() {
  const params = new URLSearchParams(window.location.search);
  const googleReason = params.get('auth') === 'google_error' ? params.get('reason') : '';
  const googleErrors: Record<string, string> = {
    access_denied: 'Die Google-Anmeldung wurde abgebrochen.',
    invalid_state: 'Die Google-Anmeldung konnte nicht sicher abgeschlossen werden. Bitte versuche es erneut.',
    google_email_not_verified: 'Die E-Mail-Adresse deines Google-Kontos ist nicht bestätigt.',
    google_account_conflict: 'Diese E-Mail-Adresse ist bereits mit einem anderen Google-Konto verbunden.',
    callback_failed: 'Die Google-Anmeldung konnte nicht abgeschlossen werden. Bitte versuche es erneut.',
  };
  const [oauthError, setOAuthError] = useState(googleReason ? (googleErrors[googleReason] || 'Die Google-Anmeldung konnte nicht abgeschlossen werden.') : '');
  const [authOpen, setAuthOpen] = useState(Boolean(googleReason));
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const { user, loading } = useAuth();
  const authTriggerRef = useRef<HTMLButtonElement>(null);
  const closeAuth = useCallback(() => {
    setAuthOpen(false);
    setOAuthError('');
    const query = new URLSearchParams(window.location.search);
    if (query.has('auth')) {
      query.delete('auth');
      query.delete('reason');
      const search = query.toString();
      window.history.replaceState({}, '', `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`);
    }
  }, []);

  function openAuth(mode: 'login' | 'register') {
    setAuthMode(mode);
    setOAuthError('');
    setAuthOpen(true);
  }

  return (
    <>
      <header className="site-header-shell">
        <div className="site-header container">
          <AppLink className="brand" to="/" aria-label="DFBK.app Startseite">
            <img className="brand-logo" src="/brand/dfbk-logo.svg" alt="DFBK.app – Dein Foto bringt Kunden" />
          </AppLink>
          <nav aria-label="Hauptnavigation">
            <a href="/#features">Funktionen</a>
            <a href="/#how">So funktioniert's</a>
            <a href="/#pricing">Preise</a>
            <AppLink to="/integrations">Integrationen</AppLink>
          </nav>
          <div className="header-actions">
            {user ? (
              <AppLink className="header-account" to="/app"><span>{user.email.slice(0, 1).toUpperCase()}</span>Mein Bereich</AppLink>
            ) : (
              <button ref={authTriggerRef} className="header-login" type="button" disabled={loading} onClick={() => openAuth('login')}>Anmelden</button>
            )}
            {user ? <AppLink className="button button-small" to="/app/new">Neues Projekt</AppLink> : <button className="button button-small" type="button" onClick={() => openAuth('register')}>Kostenlos testen</button>}
          </div>
        </div>
      </header>
      <AuthModal open={authOpen} initialMode={authMode} initialError={oauthError} onClose={closeAuth} onAuthenticated={() => navigate('/app')} returnFocusRef={authTriggerRef} />
    </>
  );
}
