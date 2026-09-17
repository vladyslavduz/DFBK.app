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
          {features.map((feature, index) => (
            <figure
              className="feature-item"
              data-feature-reveal
              key={`${feature.profession}-${feature.name}`}
            >
              <img
                src={feature.src}
                alt={`${feature.name} – Beispiel aus ${feature.profession}`}
                draggable="false"
                loading={index < 2 ? 'eager' : 'lazy'}
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
