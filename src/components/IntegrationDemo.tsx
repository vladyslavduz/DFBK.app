import '../styles/integrations-demo.css';

const channels = [
  ['instagram.svg', 'Instagram'],
  ['facebook.svg', 'Facebook'],
  ['google-business.svg', 'Google Business'],
  ['pinterest.svg', 'Pinterest'],
  ['website.svg', 'Website'],
  ['x.svg', 'X'],
  ['linkedin.svg', 'LinkedIn']
] as const;

const base = '/visual/integrations';
const icons = `${base}/icons`;
const squareBrand = '/brand/favicon/android-chrome-512x512.png';

function FilledImage({ src, alt = '', className = '' }: { src: string; alt?: string; className?: string }) {
  return (
    <div className={`integration-demo__image-frame ${className}`.trim()}>
      <img className="integration-demo__image-fill" src={src} alt="" aria-hidden="true" />
      <img className="integration-demo__image-main" src={src} alt={alt} />
    </div>
  );
}

function HaircutTools() {
  return (
    <div className="integration-demo__haircut-tools" aria-hidden="true">
      <svg className="integration-demo__scissors" viewBox="0 0 120 120">
        <circle cx="28" cy="82" r="14" />
        <circle cx="54" cy="91" r="14" />
        <path d="M39 75 101 20" />
        <path d="M46 79 104 64" />
        <path d="M43 79 60 64" />
      </svg>
      <svg className="integration-demo__comb" viewBox="0 0 140 80">
        <path d="M16 22h106" />
        <path d="M22 22v38M33 22v34M44 22v38M55 22v34M66 22v38M77 22v34M88 22v38M99 22v34M110 22v38" />
        <path d="M16 22c-5 0-8 4-8 9s3 9 8 9" />
      </svg>
      <span className="integration-demo__haircut-orbit" />
    </div>
  );
}

export default function IntegrationDemo() {
  return (
    <section className="integration-demo" aria-label="DFBK Content-Demo">
      <div className="integration-demo__copy">
        <span className="integration-demo__kicker">So funktioniert DFBK</span>
        <h2>DFBK macht daraus Content.</h2>
        <p>Du machst die Arbeit. DFBK macht sie sichtbar.</p>
      </div>

      <div className="integration-demo__stage">
        <div className="integration-demo__scene integration-demo__scene--before" aria-hidden="true">
          <FilledImage src={`${base}/friseur-before.webp`} className="integration-demo__scene-frame" />
          <div className="integration-demo__scene-label">Original</div>
        </div>

        <HaircutTools />

        <div className="integration-demo__scene integration-demo__scene--aftercut" aria-hidden="true">
          <FilledImage src={`${base}/friseur-after.webp`} className="integration-demo__scene-frame" />
          <div className="integration-demo__scene-label integration-demo__scene-label--aftercut">Nach dem Schnitt</div>
        </div>

        <div className="integration-demo__phone-photo" aria-hidden="true">
          <div className="integration-demo__phone-shell">
            <div className="integration-demo__phone-notch" />
            <div className="integration-demo__phone-screen">
              <img src={`${base}/friseur-after.webp`} alt="" />
              <div className="integration-demo__focus-box" />
              <div className="integration-demo__flash integration-demo__flash--1" />
              <div className="integration-demo__flash integration-demo__flash--2" />
              <div className="integration-demo__flash integration-demo__flash--3" />
            </div>
            <div className="integration-demo__phone-controls">
              <span className="integration-demo__phone-thumb"><img src={`${base}/friseur-after.webp`} alt="" /></span>
              <span className="integration-demo__phone-shutter" />
              <span className="integration-demo__phone-switch">↻</span>
            </div>
          </div>
        </div>

        <div className="integration-demo__captured" aria-hidden="true">
          <figure className="integration-demo__shot integration-demo__shot--1"><img src={`${base}/friseur-after.webp`} alt="" /></figure>
          <figure className="integration-demo__shot integration-demo__shot--2"><img src={`${base}/friseur-after.webp`} alt="" /></figure>
          <figure className="integration-demo__shot integration-demo__shot--3"><img src={`${base}/friseur-after.webp`} alt="" /></figure>
        </div>

        <div className="integration-demo__processor" aria-hidden="true">
          <div className="integration-demo__processor-aura" />
          <div className="integration-demo__processor-core">
            <div className="integration-demo__processor-photo integration-demo__processor-photo--source">
              <FilledImage src={`${base}/friseur-after.webp`} className="integration-demo__processor-frame" />
            </div>
            <div className="integration-demo__processor-photo integration-demo__processor-photo--optimized">
              <FilledImage src={`${base}/friseur-optimized.webp`} className="integration-demo__processor-frame" />
            </div>
            <div className="integration-demo__processor-spark integration-demo__processor-spark--1" />
            <div className="integration-demo__processor-spark integration-demo__processor-spark--2" />
            <div className="integration-demo__processor-spark integration-demo__processor-spark--3" />
            <img className="integration-demo__neon-logo" src={squareBrand} alt="" />
            <div className="integration-demo__processing-line" />
            <div className="integration-demo__processing-outline" />
          </div>
          <div className="integration-demo__steps">
            <span>Bild optimieren</span>
            <span>Licht &amp; Farben</span>
            <span>Beschreibung erstellen</span>
          </div>
        </div>

        <div className="integration-demo__optimized" aria-hidden="true">
          <FilledImage src={`${base}/friseur-optimized.webp`} className="integration-demo__scene-frame" />
          <div className="integration-demo__shine" />
          <div className="integration-demo__optimized-badge">DFBK.app optimiert</div>
          <div className="integration-demo__optimized-copy">
            <strong>Professioneller Content.</strong>
            <span>Bereit für deine Kanäle.</span>
          </div>
        </div>

        <div className="integration-demo__channels" aria-hidden="true">
          <div className="integration-demo__channel-track">
            {[...channels, ...channels].map(([file, name], index) => (
              <article className="integration-demo__channel-card" key={`${name}-${index}`}>
                <div className="integration-demo__channel-heading">
                  <img src={`${icons}/${file}`} alt="" />
                  <strong>{name}</strong>
                </div>
                <div className="integration-demo__channel-media">
                  <img src={`${base}/friseur-optimized.webp`} alt="" />
                </div>
                <span />
                <span />
              </article>
            ))}
          </div>
        </div>

        <div className="integration-demo__final" aria-hidden="true">
          <div className="integration-demo__compare-grid">
            <figure className="integration-demo__compare-card">
              <figcaption>Original</figcaption>
              <FilledImage src={`${base}/friseur-before.webp`} className="integration-demo__compare-frame" />
            </figure>
            <figure className="integration-demo__compare-card integration-demo__compare-card--optimized">
              <figcaption>DFBK.app optimiert</figcaption>
              <FilledImage src={`${base}/friseur-optimized.webp`} className="integration-demo__compare-frame" />
            </figure>
          </div>
        </div>
      </div>

      <div className="integration-demo__footer">
        <span>Arbeit erledigen</span><i />
        <span>Foto aufnehmen</span><i />
        <span>DFBK verarbeitet</span><i />
        <span>Content veröffentlichen</span>
      </div>
    </section>
  );
}
