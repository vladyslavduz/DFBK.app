import AppLink from '../components/AppLink';

export default function Hero() {
  return (
    <section id="top" className="hero section">
      <div className="container hero-grid">
        <div>
          <span className="eyebrow">Für Handwerker & kleine Betriebe</span>
          <h1>Aus deinen Arbeitsfotos wird fertiges Marketing.</h1>
          <p className="lead">Foto hochladen. DFBK erkennt die Arbeit und erstellt automatisch passende Inhalte für Website, Google und Social Media.</p>
          <div className="actions">
            <AppLink id="start" className="button" to="/app/new">Jetzt testen</AppLink>
            <a className="button button-secondary" href="#how">Demo ansehen</a>
          </div>
        </div>
        <div className="hero-showcase">
          <iframe
            src="/visual/dfbk-showcase/index.html?embed=1"
            title="So verwandelt DFBK Arbeitsfotos in neue Kundenanfragen"
            loading="eager"
          />
        </div>
      </div>
    </section>
  );
}
