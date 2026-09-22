import { type ReactNode, useEffect, useRef } from 'react';

type FeatureShellProps = {
  step: string;
  profession: string;
  professionIcon: string;
  photo: string;
  photoAlt: string;
  title: string;
  description: string;
  note: string;
  children: ReactNode;
};

function FeatureShell({ step, profession, professionIcon, photo, photoAlt, title, description, note, children }: FeatureShellProps) {
  return (
    <article className="feature-demo" data-feature-reveal>
      <div className="feature-demo-window">
        <header className="feature-demo-header">
          <span className="feature-demo-brand"><span className="feature-demo-dot" />DFBK.app</span>
          <span className="feature-demo-progress">{step} / 06</span>
        </header>
        <div className="feature-demo-content">
          <div className="feature-demo-photo-wrap">
            <img className="feature-demo-photo" src={photo} alt={photoAlt} draggable="false" loading="lazy" decoding="async" />
            <span className="feature-demo-profession"><span aria-hidden="true">{professionIcon}</span>{profession}</span>
          </div>
          <div className="feature-demo-actions">{children}</div>
        </div>
      </div>
      <div className="feature-demo-copy">
        <span className="feature-demo-title-icon" aria-hidden="true">◉</span>
        <h3>{title}</h3>
        <p>{description}</p>
        <div className="feature-demo-note"><span aria-hidden="true" />{note}</div>
      </div>
    </article>
  );
}

function PraxisFeatureDemo() {
  return (
    <FeatureShell step="01" profession="Praxis" professionIcon="✚" photo="/visual/features/praxis-feature-photo.webp" photoAlt="Mitarbeiterin dokumentiert eine Arbeit in der Praxis" title="Foto, Text oder Sprache" description="Lade Fotos deiner Arbeit hoch und ergänze die wichtigsten Informationen per Text oder Sprache." note="Einfach dokumentieren. DFBK erledigt den Rest.">
      <div className="feature-demo-row feature-demo-row-blue"><span className="feature-demo-icon" aria-hidden="true">⌾</span><span>Foto hinzufügen</span><span className="feature-demo-arrow" aria-hidden="true">›</span></div>
      <div className="feature-demo-row feature-demo-row-amber"><span className="feature-demo-icon" aria-hidden="true">≡</span><span>Text schreiben</span><span className="feature-demo-arrow" aria-hidden="true">›</span></div>
      <div className="feature-demo-row feature-demo-row-green"><span className="feature-demo-icon" aria-hidden="true">◉</span><span>Sprache aufnehmen</span><span className="feature-demo-arrow" aria-hidden="true">›</span></div>
      <div className="feature-demo-next">Weiter</div>
    </FeatureShell>
  );
}

function AnalysisFeatureDemo() {
  return (
    <FeatureShell step="02" profession="Handwerk" professionIcon="◆" photo="/visual/features/handwerk-feature-photo.webp" photoAlt="Maßgefertigter Einbauschrank aus Holz" title="Intelligente Fotoanalyse" description="DFBK erkennt Ergebnisse, Materialien und wichtige Details deiner Arbeit automatisch." note="Wichtige Details automatisch erkennen.">
      <div className="feature-analysis-panel">
        <div className="feature-panel-heading"><strong>Foto wird analysiert</strong><span className="feature-check" aria-hidden="true">✓</span></div>
        <div className="feature-analysis-track" aria-hidden="true"><span /></div>
        <span className="feature-panel-label">ERKANNT</span>
        <div className="feature-tag-list"><span>Eiche</span><span>Einbauschrank</span><span>LED-Beleuchtung</span><span>Maßarbeit</span></div>
        <div className="feature-panel-button feature-panel-button-dark">Details übernehmen</div>
      </div>
    </FeatureShell>
  );
}

function TextFeatureDemo() {
  return (
    <FeatureShell step="03" profession="Friseur" professionIcon="✂" photo="/visual/features/friseur-feature-photo.webp" photoAlt="Elegante Hochsteckfrisur im Friseursalon" title="Professionelle Texte mit DFBK.app" description="Aus deinen Angaben erstellt DFBK.app verständliche und überzeugende Beschreibungen für deine Kunden." note="Professionell formuliert. Sofort einsatzbereit.">
      <div className="feature-text-panel">
        <span className="feature-ready-badge"><span aria-hidden="true" />DFBK.app fertig</span>
        <strong className="feature-generated-title">Elegante Hochsteckfrisur</strong>
        <p>Eine moderne, locker gesteckte Frisur mit sanften Highlights und natürlichem Finish. Ideal für besondere Anlässe.</p>
        <div className="feature-panel-divider" />
        <div className="feature-split-actions"><div className="feature-panel-button feature-panel-button-light">Bearbeiten</div><div className="feature-panel-button">Übernehmen</div></div>
      </div>
    </FeatureShell>
  );
}

function ChannelsFeatureDemo() {
  const channels = [
    { icon: 'W', label: 'Website', tone: 'blue' },
    { icon: 'G', label: 'Google Business', tone: 'amber' },
    { icon: 'S', label: 'Social Media', tone: 'purple' }
  ];
  return (
    <FeatureShell step="04" profession="Beratung" professionIcon="▣" photo="/visual/features/beratung-feature-photo.webp" photoAlt="Beraterin präsentiert Inhalte auf einem Tablet" title="Content für alle Kanäle" description="Erhalte passende Inhalte für deine Website, Google Business und Social Media." note="Ein Inhalt. Passend für mehrere Kanäle.">
      <div className="feature-channel-panel">
        <strong>Für jeden Kanal vorbereitet</strong>
        <div className="feature-channel-list">
          {channels.map((channel) => <div className="feature-channel-row" key={channel.label}><span className={'feature-channel-icon feature-channel-icon-' + channel.tone}>{channel.icon}</span><span>{channel.label}</span><span className="feature-check" aria-hidden="true">✓</span></div>)}
        </div>
        <span className="feature-ready-copy">3 Versionen bereit</span>
      </div>
    </FeatureShell>
  );
}

function ProjectsFeatureDemo() {
  const projects = [
    { label: 'Döner Teller', tone: 'amber' },
    { label: 'Catering', tone: 'green' },
    { label: 'Mittagsmenü', tone: 'blue' },
    { label: 'Kundenauftrag', tone: 'purple' }
  ];
  return (
    <FeatureShell step="05" profession="Gastronomie" professionIcon="♨" photo="/visual/features/gastronomie-projects-photo.webp" photoAlt="Professionell angerichtetes Gericht in der Gastronomie" title="Projekte und Referenzen" description="Speichere deine Arbeiten übersichtlich und baue Schritt für Schritt deine digitale Referenzsammlung auf." note="Deine besten Arbeiten jederzeit griffbereit.">
      <div className="feature-project-panel">
        <div className="feature-panel-heading"><strong>Meine Referenzen</strong><span className="feature-project-count">12 Projekte</span></div>
        <div className="feature-project-grid">
          {projects.map((project) => <div className={'feature-project-card feature-project-card-' + project.tone} key={project.label}><span className="feature-project-art" aria-hidden="true"><span /></span><strong>{project.label}</strong></div>)}
        </div>
      </div>
    </FeatureShell>
  );
}

function ActionsFeatureDemo() {
  const actions = [
    { icon: '▣', label: 'Kopieren', tone: 'blue' },
    { icon: '✎', label: 'Bearbeiten', tone: 'amber' },
    { icon: '↑', label: 'Exportieren', tone: 'green' }
  ];
  return (
    <FeatureShell step="06" profession="Gastronomie" professionIcon="♨" photo="/visual/features/gastronomie-actions-photo.webp" photoAlt="Fertiger Gastronomie-Inhalt für die weitere Verwendung" title="Einfach verwenden" description="Kopiere, exportiere oder bearbeite die fertigen Inhalte mit wenigen Klicks." note="Fertig bedeutet: direkt weiterverwenden.">
      <div className="feature-use-panel">
        <div className="feature-content-preview"><span className="feature-preview-art" aria-hidden="true"><span /></span><div><strong>Dein Inhalt ist fertig</strong><span /><span /><span /></div></div>
        <div className="feature-use-actions">
          {actions.map((action) => <div className={'feature-use-action feature-use-action-' + action.tone} key={action.label}><span aria-hidden="true">{action.icon}</span><strong>{action.label}</strong></div>)}
        </div>
      </div>
    </FeatureShell>
  );
}

export default function Features() {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const slides = [...list.querySelectorAll<HTMLElement>('[data-feature-reveal]')];
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionPreference.matches) {
      slides.forEach((slide) => slide.classList.add('is-visible'));
      return;
    }
    list.classList.add('is-reveal-ready');
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.target.classList.toggle('is-visible', entry.isIntersecting)),
      { threshold: 0.18, rootMargin: '-6% 0px -6% 0px' }
    );
    slides.forEach((slide) => observer.observe(slide));
    return () => observer.disconnect();
  }, []);

  return (
    <section id="features" className="section feature-slider-section">
      <div className="container">
        <span className="eyebrow">Funktionen</span>
        <h2>DFBK.app macht Marketing einfacher</h2>
        <div className="feature-list" ref={listRef}>
          <PraxisFeatureDemo />
          <AnalysisFeatureDemo />
          <TextFeatureDemo />
          <ChannelsFeatureDemo />
          <ProjectsFeatureDemo />
          <ActionsFeatureDemo />
        </div>
      </div>
    </section>
  );
}
