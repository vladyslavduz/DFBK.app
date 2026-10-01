import PageShell from '../components/PageShell';
import IntegrationDemo from '../components/IntegrationDemo';
import '../styles/integrations-share.css';

const social = [
  ['https://cdn.simpleicons.org/instagram/E4405F', 'Instagram'],
  ['https://cdn.simpleicons.org/facebook/0866FF', 'Facebook'],
  ['https://cdn.simpleicons.org/tiktok/000000', 'TikTok'],
  ['https://cdn.simpleicons.org/linkedin/0A66C2', 'LinkedIn'],
  ['https://cdn.simpleicons.org/pinterest/BD081C', 'Pinterest'],
  ['https://cdn.simpleicons.org/x/000000', 'X']
] as const;

const messengers = [
  ['https://cdn.simpleicons.org/whatsapp/25D366', 'WhatsApp'],
  ['https://cdn.simpleicons.org/messenger/00B2FF', 'Messenger'],
  ['https://cdn.simpleicons.org/telegram/26A5E4', 'Telegram'],
  ['https://cdn.simpleicons.org/signal/3A76F0', 'Signal']
] as const;

const websites = [
  ['https://cdn.simpleicons.org/wordpress/21759B', 'WordPress'],
  ['https://cdn.simpleicons.org/wix/0C0C0C', 'Wix'],
  ['https://cdn.simpleicons.org/joomla/5091CD', 'Joomla'],
  ['https://cdn.simpleicons.org/webflow/146EF5', 'Webflow'],
  ['https://cdn.simpleicons.org/squarespace/000000', 'Squarespace']
] as const;

function BrandRow({ items }: { items: readonly (readonly [string, string])[] }) {
  return (
    <div className="share-brand-row">
      {items.map(([src, name]) => (
        <button className="share-brand" type="button" key={name} aria-label={name} title={name}>
          <img src={src} alt="" />
        </button>
      ))}
    </div>
  );
}

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

        <div className="share-zone share-zone--compact">
          <h3>Teilen · Soziale Netzwerke</h3>
          <BrandRow items={social} />
        </div>

        <div className="share-zone share-zone--compact">
          <h3>Teilen · Messenger</h3>
          <BrandRow items={messengers} />
        </div>

        <div className="share-zone share-zone--compact">
          <h3>Teilen · Website &amp; CMS</h3>
          <BrandRow items={websites} />
        </div>

        <p className="share-hub__note">
          <strong>Prototyp:</strong> Die Symbole sind noch ohne Funktion. Im nächsten Schritt verbinden wir jeden Kanal mit dem passenden Share-, API- oder Embed-Workflow.
        </p>
      </section>
    </PageShell>
  );
}
