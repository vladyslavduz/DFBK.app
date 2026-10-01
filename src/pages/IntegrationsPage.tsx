import PageShell from '../components/PageShell';
import IntegrationDemo from '../components/IntegrationDemo';
import '../styles/integrations-share.css';

const icons = '/visual/integrations/icons';

const social = [
  ['instagram.svg', 'Instagram', 'Feed / Reel'],
  ['facebook.svg', 'Facebook', 'Post / Story'],
  ['linkedin.svg', 'LinkedIn', 'Post'],
  ['x.svg', 'X', 'Post'],
  ['pinterest.svg', 'Pinterest', 'Pin']
] as const;

const messengers = [
  ['whatsapp.svg', 'WhatsApp', 'Chat / Status'],
  ['telegram.svg', 'Telegram', 'Chat / Kanal']
] as const;

const websites = [
  ['WP', 'WordPress', 'Embed / Media'],
  ['J!', 'Joomla', 'Embed / Media'],
  ['W', 'Wix', 'Embed'],
  ['WF', 'Webflow', 'Embed'],
  ['</>', 'Eigene Website', 'HTML / Link']
] as const;

export default function IntegrationsPage() {
  return (
    <PageShell
      eyebrow="Integrationen"
      title="Kanäle verbinden"
      intro="Aus einem Foto wird professioneller Content für Website, Google Business und Social Media."
    >
      <IntegrationDemo />

      <section className="share-hub" aria-label="DFBK teilen">
        <div className="share-hub__intro">
          <span className="share-hub__eyebrow">DFBK teilen</span>
          <h2>Zeig, was DFBK aus einem Foto machen kann.</h2>
          <p>Wähle einen Kanal. Später wird hier das fertige Promo-Video zusammen mit einem passenden Werbetext geteilt.</p>
        </div>

        <div className="share-hub__package">
          <div className="share-hub__preview" aria-hidden="true">
            <img className="share-hub__preview-bg" src="/visual/integrations/friseur-optimized.webp" alt="" />
            <img className="share-hub__preview-main" src="/visual/integrations/friseur-optimized.webp" alt="" />
          </div>

          <div className="share-hub__message">
            <h3>Vorschau des Werbetextes</h3>
            <p>
              <strong>Du machst die Arbeit. DFBK macht sie sichtbar.</strong><br /><br />
              Aus einem Foto deiner Arbeit erstellt DFBK optimierten Content für Website, Google und Social Media – schnell, einfach und ohne Marketing-Stress.<br /><br />
              <strong>Dein Foto bringt Kunden.</strong>
            </p>
            <span className="share-hub__url">dfbk.app</span>
          </div>
        </div>

        <div className="share-zone">
          <div className="share-zone__head">
            <h3>Soziale Netzwerke</h3>
            <span>Video + Werbetext + Link</span>
          </div>
          <div className="share-zone__grid">
            {social.map(([file, name, meta]) => (
              <div className="share-tile" key={name}>
                <img src={`${icons}/${file}`} alt="" />
                <strong>{name}</strong>
                <small>{meta}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="share-zone">
          <div className="share-zone__head">
            <h3>Messenger</h3>
            <span>Direkt senden oder systemweit teilen</span>
          </div>
          <div className="share-zone__grid">
            {messengers.map(([file, name, meta]) => (
              <div className="share-tile" key={name}>
                <img src={`${icons}/${file}`} alt="" />
                <strong>{name}</strong>
                <small>{meta}</small>
              </div>
            ))}
            <div className="share-tile">
              <span className="share-tile__glyph">M</span>
              <strong>Messenger</strong>
              <small>Direkt teilen</small>
            </div>
            <div className="share-tile">
              <span className="share-tile__glyph">S</span>
              <strong>Signal</strong>
              <small>System Share</small>
            </div>
            <div className="share-tile">
              <span className="share-tile__glyph">•••</span>
              <strong>Mehr</strong>
              <small>Weitere Apps</small>
            </div>
          </div>
        </div>

        <div className="share-zone">
          <div className="share-zone__head">
            <h3>Website &amp; CMS</h3>
            <span>Einbetten, kopieren oder später direkt verbinden</span>
          </div>
          <div className="share-zone__grid">
            {websites.map(([glyph, name, meta]) => (
              <div className="share-tile" key={name}>
                <span className="share-tile__glyph">{glyph}</span>
                <strong>{name}</strong>
                <small>{meta}</small>
              </div>
            ))}
          </div>
        </div>

        <p className="share-hub__note">
          <strong>Prototyp:</strong> Die Elemente sind absichtlich noch ohne Funktion. Im nächsten Schritt definieren wir pro Kanal Share-Link, Web Share, OAuth/API oder Embed-Workflow.
        </p>
      </section>
    </PageShell>
  );
}
