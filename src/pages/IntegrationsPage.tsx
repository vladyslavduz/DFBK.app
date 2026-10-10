import { useEffect, useMemo, useState } from 'react';
import PageShell from '../components/PageShell';
import IntegrationDemo from '../components/IntegrationDemo';
import { useUserArea } from '../contexts/UserAreaContext';
import { openIntegrationTarget, type IntegrationPlatform } from '../services/integration-share';
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

const platformCards: Array<{
  platform: IntegrationPlatform;
  label: string;
  icon: string;
  description: string;
  button: string;
}> = [
  { platform: 'whatsapp', label: 'WhatsApp', icon: 'whatsapp.svg', description: 'In WhatsApp teilen.', button: 'Teilen' },
  { platform: 'facebook', label: 'Facebook', icon: 'facebook.svg', description: 'Auf Facebook öffnen und teilen.', button: 'Teilen' },
  { platform: 'instagram', label: 'Instagram', icon: 'instagram.svg', description: 'Instagram öffnen. Bild und Text bleiben separat verfügbar.', button: 'Öffnen' },
  { platform: 'x', label: 'X', icon: 'x.svg', description: 'Auf X teilen.', button: 'Teilen' },
  { platform: 'linkedin', label: 'LinkedIn', icon: 'linkedin.svg', description: 'LinkedIn öffnen und teilen.', button: 'Teilen' },
  { platform: 'pinterest', label: 'Pinterest', icon: 'pinterest.svg', description: 'Pinterest öffnen. Private Bilder werden nicht automatisch übertragen.', button: 'Öffnen' },
  { platform: 'email', label: 'E-Mail', icon: 'email.svg', description: 'Per E-Mail teilen.', button: 'Teilen' },
];

export default function IntegrationsPage() {
  const { plan, projects, getProjectContent } = useUserArea();
  const [feedback, setFeedback] = useState('');
  const [socialText, setSocialText] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const shareEnabled = plan.source === 'backend' && plan.status === 'active' && plan.features.share;

  const latestReadyProject = useMemo(
    () => projects.find(project => project.status === 'ready' || project.content),
    [projects],
  );

  useEffect(() => {
    let active = true;

    async function loadLatestContent() {
      if (!shareEnabled || !latestReadyProject) {
        setSocialText('');
        setProjectTitle('');
        return;
      }

      setProjectTitle(latestReadyProject.title);
      if (latestReadyProject.content?.social) {
        setSocialText(latestReadyProject.content.social);
        return;
      }

      try {
        const content = await getProjectContent(latestReadyProject.id);
        if (!active) return;
        setSocialText(content?.social || '');
      } catch {
        if (!active) return;
        setSocialText('');
      }
    }

    void loadLatestContent();
    return () => { active = false; };
  }, [getProjectContent, latestReadyProject, shareEnabled]);

  function openPlatform(platform: IntegrationPlatform) {
    setFeedback('');
    if (!shareEnabled) {
      setFeedback('Direktes Teilen ist mit einem aktiven DFBK-Zugang und einem fertigen Projekt verfügbar.');
      return;
    }
    if (!socialText) {
      setFeedback('Kein fertiger Social-Media-Text verfügbar. Öffne zuerst ein fertiges Projekt.');
      return;
    }

    const result = openIntegrationTarget(platform, {
      title: projectTitle || 'DFBK.app',
      text: socialText,
    });

    if (result === 'blocked') {
      setFeedback('Link konnte nicht geöffnet werden. Nutze Kopieren, Bild herunterladen oder die allgemeine Teilen-Funktion im Projekt.');
      return;
    }

    if (platform === 'instagram') {
      setFeedback('Instagram wurde geöffnet. Bild und Text werden nicht automatisch übertragen.');
    } else if (platform === 'pinterest') {
      setFeedback('Pinterest wurde geöffnet. Private Projektbilder werden nicht automatisch übertragen.');
    }
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
          <span className="share-hub__eyebrow">Direct Share v1</span>
          <h2>So kannst du deinen Content weitergeben.</h2>
          <p>Brand-Schaltflächen öffnen den gewählten Dienst direkt. Die allgemeine Teilen-Funktion im Projekt nutzt weiterhin das System-Menü.</p>
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

          {platformCards.map(card => (
            <article className="mvp-integration-card" key={card.platform}>
              <img src={`${localIcons}/${card.icon}`} alt="" />
              <div><strong>{card.label}</strong><span>{card.description}</span></div>
              <button
                type="button"
                onClick={() => openPlatform(card.platform)}
                disabled={!shareEnabled || !socialText}
                title={!shareEnabled ? 'Aktiver DFBK-Zugang erforderlich' : !socialText ? 'Kein fertiger Social-Media-Text verfügbar' : undefined}
              >
                {card.button}
              </button>
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
