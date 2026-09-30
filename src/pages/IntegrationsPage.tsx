import PageShell from '../components/PageShell';
import { integrationPrinciples, integrationStatusLabels, primaryIntegrations, websiteIntegrations, type IntegrationProvider } from '../config/integrations';

function IntegrationCard({ provider, featured = false }: { provider: IntegrationProvider; featured?: boolean }) {
  return (
    <article className={`integration-v1-card${featured ? ' is-featured' : ''}`}>
      <div className="integration-v1-card-head">
        <span className="integration-v1-logo" aria-hidden="true">{provider.shortName}</span>
        <span className={`integration-v1-status status-${provider.status}`}>{integrationStatusLabels[provider.status]}</span>
      </div>
      <div>
        <span className="integration-v1-capability">{provider.capability}</span>
        <h3>{provider.name}</h3>
        <p>{provider.description}</p>
      </div>
      <button className="button button-secondary integration-v1-action" type="button" disabled>
        {provider.status === 'placeholder' ? 'Kommt später' : provider.status === 'planned' ? 'Geplant' : 'Verbindung vorbereiten'}
      </button>
    </article>
  );
}

export default function IntegrationsPage() {
  return (
    <PageShell
      eyebrow="Integrationen"
      title="DFBK.app mit deinen Kanälen verbinden"
      intro="Heute bereitest du Inhalte in DFBK.app vor. Später kannst du deine bevorzugten Kanäle verbinden und Veröffentlichungen direkt aus deinem Projekt steuern."
    >
      <div className="integration-v1-page">
        <section className="integration-v1-hero-panel">
          <div>
            <span className="app-kicker">Einmal erstellen. Mehrfach nutzen.</span>
            <h2>Deine Arbeit dort sichtbar machen, wo deine Kunden dich finden.</h2>
            <p>DFBK.app soll langfristig nicht nur Inhalte erstellen, sondern sie kontrolliert an Website, Google und Social Media weitergeben.</p>
          </div>
          <div className="integration-v1-flow" aria-label="DFBK.app Veröffentlichungsfluss">
            <span>Foto & Projekt</span><i>→</i><strong>DFBK.app</strong><i>→</i><span>Website · Google · Social</span>
          </div>
        </section>

        <section className="integration-v1-section">
          <header className="integration-v1-section-heading">
            <span className="app-kicker">Wichtige Kanäle</span>
            <h2>Direkte Sichtbarkeit vorbereiten</h2>
            <p>Google bleibt zunächst bewusst als Platzhalter. Social Media wird technisch für eine spätere API-Anbindung vorbereitet.</p>
          </header>
          <div className="integration-v1-featured-grid">
            {primaryIntegrations.map(provider => <IntegrationCard provider={provider} featured key={provider.id} />)}
          </div>
        </section>

        <section className="integration-v1-section">
          <header className="integration-v1-section-heading">
            <span className="app-kicker">Website & CMS</span>
            <h2>Dein Website-System direkt anbinden</h2>
            <p>Die Oberfläche ist schon so aufgebaut, dass später pro Anbieter ein eigener Connector, OAuth-Flow oder API-Endpunkt ergänzt werden kann.</p>
          </header>
          <div className="integration-v1-provider-grid">
            {websiteIntegrations.map(provider => <IntegrationCard provider={provider} key={provider.id} />)}
          </div>
        </section>

        <section className="integration-v1-automation">
          <div>
            <span className="app-kicker">Nächster Schritt</span>
            <h2>Später: kontrolliert automatisch veröffentlichen</h2>
            <p>Zielbild: Du prüfst Bild und Text einmal in DFBK.app und entscheidest dann, ob direkt veröffentlicht oder zunächst nur vorbereitet werden soll.</p>
          </div>
          <div className="integration-v1-automation-steps">
            <span>1. Projekt fertigstellen</span>
            <span>2. Kanäle auswählen</span>
            <span>3. Inhalt prüfen</span>
            <span>4. Veröffentlichen</span>
          </div>
        </section>

        <section className="integration-v1-safety">
          <div>
            <span className="app-kicker">Kontrolle bleibt bei dir</span>
            <h2>Keine automatische Veröffentlichung ohne Freigabe.</h2>
          </div>
          <ul>{integrationPrinciples.map(item => <li key={item}>✓ {item}</li>)}</ul>
        </section>
      </div>
    </PageShell>
  );
}
