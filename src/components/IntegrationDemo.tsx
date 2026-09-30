import '../styles/integrations-demo.css';

const channels = [
  ['IG', 'Instagram', 'ig'],
  ['f', 'Facebook', 'fb'],
  ['G', 'Google Business', 'google'],
  ['P', 'Pinterest', 'pin'],
  ['⌂', 'Website', 'web']
] as const;

export default function IntegrationDemo() {
  return (
    <section className="integration-demo" aria-label="DFBK Content-Demo">
      <div className="integration-demo__copy">
        <span className="integration-demo__kicker">So funktioniert DFBK</span>
        <h2>DFBK macht daraus Content.</h2>
        <p>
          Ein Foto vom Smartphone wird optimiert, mit professionellem Text ergänzt und für deine Kanäle vorbereitet.
        </p>
      </div>

      <div className="integration-demo__stage">
        <div className="integration-demo__salon" aria-hidden="true" />

        <div className="integration-demo__phone" aria-hidden="true">
          <div className="integration-demo__phone-top">
            <span />
          </div>
          <div className="integration-demo__phone-screen">
            <img src="/visual/profession-cards/friseur.webp" alt="" />
            <div className="integration-demo__focus" />
            <div className="integration-demo__flash integration-demo__flash--one" />
            <div className="integration-demo__flash integration-demo__flash--two" />
            <div className="integration-demo__flash integration-demo__flash--three" />
          </div>
          <div className="integration-demo__phone-controls">
            <span className="integration-demo__thumb" />
            <span className="integration-demo__shutter" />
            <span className="integration-demo__switch">↻</span>
          </div>
        </div>

        <div className="integration-demo__photo-stack" aria-hidden="true">
          <div className="integration-demo__flying-photo integration-demo__flying-photo--1">
            <img src="/visual/profession-cards/friseur.webp" alt="" />
          </div>
          <div className="integration-demo__flying-photo integration-demo__flying-photo--2">
            <img src="/visual/profession-cards/friseur.webp" alt="" />
          </div>
          <div className="integration-demo__flying-photo integration-demo__flying-photo--3">
            <img src="/visual/profession-cards/friseur.webp" alt="" />
          </div>
        </div>

        <div className="integration-demo__processor" aria-hidden="true">
          <div className="integration-demo__processor-glow" />
          <img src="/brand/dfbk-mark.svg" alt="" />
          <div className="integration-demo__steps">
            <span>Bild optimieren</span>
            <span>Licht &amp; Farben</span>
            <span>Beschreibung erstellen</span>
          </div>
        </div>

        <div className="integration-demo__result" aria-hidden="true">
          <img src="/visual/profession-cards/friseur.webp" alt="" />
          <div className="integration-demo__result-shine" />
          <div className="integration-demo__result-copy">
            <strong>Frischer Look, neues Gefühl ✨</strong>
            <span>Professioneller Content – direkt bereit zum Teilen.</span>
          </div>
        </div>

        <div className="integration-demo__channels" aria-hidden="true">
          <div className="integration-demo__channel-track">
            {[...channels, ...channels].map(([icon, name, cls], index) => (
              <div className="integration-demo__channel-card" key={`${name}-${index}`}>
                <div className={`integration-demo__channel-icon integration-demo__channel-icon--${cls}`}>{icon}</div>
                <strong>{name}</strong>
                <div className="integration-demo__channel-media">
                  <img src="/visual/profession-cards/friseur.webp" alt="" />
                </div>
                <span />
                <span />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="integration-demo__footer">
        <span>Foto aufnehmen</span>
        <i />
        <span>DFBK verarbeitet</span>
        <i />
        <span>Content veröffentlichen</span>
      </div>
    </section>
  );
}
