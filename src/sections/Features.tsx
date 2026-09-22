import { useEffect, useRef } from 'react';

const features = [
  {
    name: 'Foto, Text oder Sprache',
    profession: 'Praxis',
    src: '/visual/features/01-praxis-input.webp'
  },
  {
    name: 'Intelligente Fotoanalyse',
    profession: 'Handwerk',
    src: '/visual/features/02-handwerk-analyse.webp'
  },
  {
    name: 'Professionelle Texte mit DFBK.app',
    profession: 'Friseur',
    src: '/visual/features/03-friseur-texte.webp'
  },
  {
    name: 'Content für alle Kanäle',
    profession: 'Beratung',
    src: '/visual/features/04-beratung-kanaele.webp'
  },
  {
    name: 'Projekte und Referenzen',
    profession: 'Gastronomie',
    src: '/visual/features/05-gastronomie-projekte.webp'
  },
  {
    name: 'Einfach verwenden',
    profession: 'Gastronomie',
    src: '/visual/features/06-gastronomie-verwenden.webp'
  }
];

function PraxisFeatureDemo() {
  return (
    <article className="feature-demo" data-feature-reveal>
      <div className="feature-demo-window">
        <header className="feature-demo-header">
          <span className="feature-demo-brand"><span className="feature-demo-dot" />DFBK.app</span>
          <span className="feature-demo-progress">01 / 06</span>
        </header>

        <div className="feature-demo-content">
          <div className="feature-demo-photo-wrap">
            <img
              className="feature-demo-photo"
              src="/visual/features/praxis-feature-photo.webp"
              alt="Mitarbeiterin dokumentiert eine Arbeit in der Praxis"
              draggable="false"
            />
            <span className="feature-demo-profession"><span aria-hidden="true">✚</span> Praxis</span>
          </div>

          <div className="feature-demo-actions" aria-label="Beispiel der Projekterfassung">
            <div className="feature-demo-row feature-demo-row-blue">
              <span className="feature-demo-icon" aria-hidden="true">⌾</span>
              <span>Foto hinzufügen</span>
              <span className="feature-demo-arrow" aria-hidden="true">›</span>
            </div>
            <div className="feature-demo-row feature-demo-row-amber">
              <span className="feature-demo-icon" aria-hidden="true">≡</span>
              <span>Text schreiben</span>
              <span className="feature-demo-arrow" aria-hidden="true">›</span>
            </div>
            <div className="feature-demo-row feature-demo-row-green">
              <span className="feature-demo-icon" aria-hidden="true">◉</span>
              <span>Sprache aufnehmen</span>
              <span className="feature-demo-arrow" aria-hidden="true">›</span>
            </div>
            <div className="feature-demo-next">Weiter</div>
          </div>
        </div>
      </div>

      <div className="feature-demo-copy">
        <span className="feature-demo-title-icon" aria-hidden="true">◉</span>
        <h3>Foto, Text oder Sprache</h3>
        <p>Lade Fotos deiner Arbeit hoch und ergänze die wichtigsten Informationen per Text oder Sprache.</p>
        <div className="feature-demo-note"><span aria-hidden="true" />Einfach dokumentieren. DFBK erledigt den Rest.</div>
      </div>
    </article>
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
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle('is-visible', entry.isIntersecting);
        });
      },
      {
        threshold: 0.18,
        rootMargin: '-6% 0px -6% 0px'
      }
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
          {features.slice(1).map((feature, index) => (
            <figure
              className="feature-item"
              data-feature-reveal
              key={`${feature.profession}-${feature.name}`}
            >
              <img
                src={feature.src}
                alt={`${feature.name} – Beispiel aus ${feature.profession}`}
                draggable="false"
                loading={index < 1 ? 'eager' : 'lazy'}
                decoding="async"
                width="1520"
                height="1520"
              />
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
