import { useCallback, useRef, useState } from 'react';
import AppLink from './AppLink';
import AuthModal from './AuthModal';

export default function Header() {
  const [authOpen, setAuthOpen] = useState(false);
  const authTriggerRef = useRef<HTMLButtonElement>(null);
  const closeAuth = useCallback(() => setAuthOpen(false), []);

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
            <button ref={authTriggerRef} className="header-login" type="button" onClick={() => setAuthOpen(true)}>
              Anmelden
            </button>
            <AppLink className="button button-small" to="/create">Kostenlos testen</AppLink>
          </div>
        </div>
      </header>
      <AuthModal open={authOpen} onClose={closeAuth} returnFocusRef={authTriggerRef} />
    </>
  );
}
