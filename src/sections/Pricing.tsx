export default function Pricing() {
  return (
    <section id="pricing" className="section section-muted">
      <div className="container narrow center">
        <span className="eyebrow">Preise</span>
        <h2>Einfach starten</h2>
        <article className="pricing-card">
          <span className="badge">MVP</span>
          <h3>DFBK Starter</h3>
          <div className="price">€ -- <small>/ Monat</small></div>
          <p>[ Preis wird nach MVP-Test festgelegt ]</p>
          <ul><li>AI Content</li><li>Projekt-Archiv</li><li>Google / Social Formate</li><li>Keine langfristige Bindung</li></ul>
          <a className="button" href="#start">Testzugang</a>
        </article>
      </div>
    </section>
  );
}
