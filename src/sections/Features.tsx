import { useEffect, useState } from 'react';

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

const DISPLAY_TIME_MS = 6000;

export default function Features() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionPreference.matches) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % features.length);
    }, DISPLAY_TIME_MS);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <section id="features" className="section feature-slider-section">
      <div className="container">
        <span className="eyebrow">Funktionen</span>
        <h2>DFBK.app macht Marketing einfacher</h2>

        <div className="feature-slider" aria-live="off">
          {features.map((feature, index) => {
            const isActive = index === activeIndex;

            return (
              <figure
                className={`feature-slide${isActive ? ' is-active' : ''}`}
                aria-hidden={!isActive}
                key={`${feature.profession}-${feature.name}`}
              >
                <img
                  src={feature.src}
                  alt={isActive ? `${feature.name} – Beispiel aus ${feature.profession}` : ''}
                  draggable="false"
                  loading={index === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                  width="1520"
                  height="1520"
                />
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}
