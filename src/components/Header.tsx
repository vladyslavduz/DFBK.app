import AppLink from './AppLink';

export default function Header() {
  return (
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
          <AppLink className="header-login" to="/login">Anmelden</AppLink>
          <AppLink className="button button-small" to="/create">Kostenlos testen</AppLink>
        </div>
      </div>
    </header>
  );
}
