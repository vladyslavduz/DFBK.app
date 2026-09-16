import { useEffect, useState } from 'react';

const professions = [
  { name: 'Gastronomie', src: '/visual/profession-cards/gastronomie.webp' },
  { name: 'Friseur', src: '/visual/profession-cards/friseur.webp' },
  { name: 'Handwerk', src: '/visual/profession-cards/handwerk.webp' },
  { name: 'Praxis', src: '/visual/profession-cards/praxis.webp' },
  { name: 'Beratung', src: '/visual/profession-cards/beratung.webp' }
];

const DISPLAY_TIME_MS = 4200;

export default function Benefits() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionPreference.matches) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % professions.length);
    }, DISPLAY_TIME_MS);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="section-muted profession-fade-section" aria-label="DFBK.app für verschiedene Branchen">
      <div className="profession-fade-frame">
        {professions.map((profession, index) => {
          const isActive = index === activeIndex;

          return (
            <figure
              className={`profession-fade-card${isActive ? ' is-active' : ''}`}
              aria-hidden={!isActive}
              key={profession.name}
            >
              <img
                src={profession.src}
                alt={isActive ? `DFBK.app für ${profession.name}` : ''}
                draggable="false"
                loading="eager"
                decoding="async"
                width="2152"
                height="731"
              />
            </figure>
          );
        })}
      </div>
    </section>
  );
}
