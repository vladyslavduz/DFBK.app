import { useState } from 'react';
import PageShell from '../components/PageShell';
import IntegrationDemo from '../components/IntegrationDemo';
import { shareTextContent } from '../services/share';
import '../styles/integrations-share.css';

const localIcons = '/visual/integrations/icons';

const demoText = [
  'Du machst die Arbeit. DFBK macht sie sichtbar.',
  '',
  'Aus einem Foto deiner Arbeit erstellt DFBK optimierten Content für Website, Google und Social Media – schnell, einfach und ohne Marketing-Stress.',
  '',
  'Dein Foto bringt Kunden.',
  'dfbk.app',
].join('\n');

type ShareChannel = 'WhatsApp' | 'Facebook' | 'Instagram';

export default function IntegrationsPage() {
  const [feedback, setFeedback] = useState('');

  async function share(channel: ShareChannel) {
    const outcome = await shareTextContent('DFBK.app', demoText);
    if (outcome === 'cancelled') return;
    setFeedback(
      outcome === 'text-shared'
        ? `Teilen-Menü geöffnet. Wähle dort ${channel}, wenn die App auf deinem Gerät verfügbar ist.`
        : 'Native Teilen wird in diesem Browser nicht unterstützt. Du kannst den Text kopieren.',
    );
  }

  async function copyForWebsite() {
    try {
      await navigator.clipboard.writeText(demoText);
      setFeedback('Text für deine Website kopiert.');
    } catch {
      setFeedback('Kopieren wird in diesem Browser nicht unterstützt.');
    }
  }

  return (
    <PageShell
      eyebrow="Integrationen"
      title="Dein Content. Deine Kanäle."
      intro="DFBK bereitet deinen Content vor. Du entscheidest, wo du ihn verwendest oder teilst."
    >
      <IntegrationDemo />

      <section className="share-hub" aria-label="DFBK teilen">
        <div className="share-hub__intro">
          <span className="share-hub__eyebrow">Native Share v1</span>
          <h2>So kannst du deinen Content weitergeben.</h2>
          <p>Nach der Registrierung funktioniert dieser Ablauf mit deinen eigenen Projekten. Teilen öffnet das System-Menü deines Geräts.</p>
        </div>

        <div className="share-hub__package">
          <div className="share-hub__preview">
            <img className="share-hub__preview-bg" src="/visual/integrations/friseur-optimized.webp" alt="" aria-hidden="true" />
            <img className="share-hub__preview-main" src="/visual/integrations/friseur-optimized.webp" alt="Beispiel eines optimierten DFBK Projektfotos" />
          </div>

          <div className="share-hub__message">
            <h3>Beispielinhalt</h3>
            <p>
              <strong>Du machst die Arbeit. DFBK macht sie sichtbar.</strong><br /><br />
              Aus einem Foto deiner Arbeit erstellt DFBK optimierten Content für Website, Google und Social Media – schnell, einfach und ohne Marketing-Stress.<br /><br />
              <strong>Dein Foto bringt Kunden.</strong>
            </p>
            <span className="share-hub__url">dfbk.app</span>
          </div>
        </div>

        <div className="mvp-integration-grid">
          <article className="mvp-integration-card is-coming">
            <img src={`${localIcons}/google-business.svg`} alt="" />
            <div><strong>Google Business</strong><span>Direkte Verbindung ist noch nicht aktiv.</span></div>
            <span className="mvp-integration-status">Demnächst</span>
          </article>

          {(['WhatsApp', 'Facebook', 'Instagram'] as const).map(channel => (
            <article className="mvp-integration-card" key={channel}>
              <img src={`${localIcons}/${channel.toLowerCase()}.svg`} alt="" />
              <div><strong>{channel}</strong><span>Öffnet das Teilen-Menü deines Geräts.</span></div>
              <button type="button" onClick={() => void share(channel)}>Teilen</button>
            </article>
          ))}

          <article className="mvp-integration-card">
            <img src={`${localIcons}/website.svg`} alt="" />
            <div><strong>Deine Website</strong><span>Content für deine eigene Website verwenden.</span></div>
            <button type="button" onClick={() => void copyForWebsite()}>Für Website verwenden</button>
          </article>
        </div>

        {feedback && <p className="share-hub__note" role="status">{feedback}</p>}
      </section>
    </PageShell>
  );
}
