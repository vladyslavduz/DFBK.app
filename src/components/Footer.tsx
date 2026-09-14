import AppLink from './AppLink';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <img className="footer-logo" src="/brand/dfbk-logo.svg" alt="DFBK.app" />
          <p>Dein Foto bringt Kunden.</p>
          <span>AI-Marketing für Handwerker und kleine Betriebe.</span>
        </div>
        <div>
          <strong>Produkt</strong>
          <AppLink to="/create">Content erstellen</AppLink>
          <AppLink to="/projects">Projekte</AppLink>
          <AppLink to="/pricing">Preise</AppLink>
          <AppLink to="/integrations">Integrationen</AppLink>
        </div>
        <div>
          <strong>Rechtliches</strong>
          <AppLink to="/impressum">Impressum</AppLink>
          <AppLink to="/datenschutz">Datenschutz</AppLink>
          <AppLink to="/agb">AGB</AppLink>
          <AppLink to="/widerruf">Widerruf</AppLink>
        </div>
      </div>
    </footer>
  );
}
