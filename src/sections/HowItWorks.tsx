const steps = [
  {
    number: '01',
    title: 'Foto aufnehmen oder hochladen',
    description: 'Fotografiere deine Arbeit direkt mit dem Smartphone oder lade ein vorhandenes Foto hoch.',
    image: '/visual/ablauf/01-foto-hochladen.webp'
  },
  {
    number: '02',
    title: 'Kurz beschreiben',
    description: 'Schreibe oder sprich kurz ein, was du gemacht hast und was dir wichtig ist.',
    image: '/visual/ablauf/02-kurz-beschreiben.webp'
  },
  {
    number: '03',
    title: 'DFBK.app versteht',
    description: 'DFBK.app erkennt dein Foto, versteht deine Angaben und verbindet alles miteinander.',
    image: '/visual/ablauf/03-dfbk-versteht.webp'
  },
  {
    number: '04',
    title: 'Inhalte erstellen & prüfen',
    description: 'DFBK.app erstellt passende Bilder und Texte. Du prüfst das Ergebnis und passt es bei Bedarf an.',
    image: '/visual/ablauf/04-inhalte-pruefen.webp'
  },
  {
    number: '05',
    title: 'Sichtbar werden',
    description: 'Nutze deine fertigen Inhalte für Website, Google und Social Media – und erreiche neue Kunden.',
    image: '/visual/ablauf/05-sichtbar-werden.webp'
  }
];

export default function HowItWorks() {
  return (
    <section id="how" className="section section-muted process-section">
      <div className="container">
        <header className="process-heading center">
          <span className="eyebrow">Ablauf</span>
          <h2>So funktioniert DFBK.app</h2>
          <p>In 5 einfachen Schritten von deiner Arbeit zu mehr Kunden.</p>
        </header>

        <ol className="process-steps">
          {steps.map((step) => (
            <li className="process-step" key={step.number}>
              <div className="process-marker" aria-hidden="true">
                <span>{step.number}</span>
              </div>
              <article className="process-card">
                <img
                  src={step.image}
                  alt=""
                  width="336"
                  height="408"
                  loading="lazy"
                  decoding="async"
                />
                <div className="process-copy">
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              </article>
            </li>
          ))}
        </ol>

        <aside className="process-summary">
          <svg aria-hidden="true" viewBox="0 0 48 48">
            <path d="M16 31c-3.7-2.6-6-6.9-6-11.5C10 11.5 16.3 5 24 5s14 6.5 14 14.5c0 4.6-2.3 8.9-6 11.5-1.7 1.2-2.8 3.2-2.8 5.3H18.8c0-2.1-1.1-4.1-2.8-5.3Z" />
            <path d="M19 41h10M20.5 36.5h7M24 1v-1M43 19.5h4M1 19.5h4M37.5 6l2.8-2.8M7.7 3.2 10.5 6" />
          </svg>
          <div>
            <strong>Eine fertige Arbeit. Viele Möglichkeiten.</strong>
            <span>Du machst die Arbeit. DFBK.app macht sie sichtbar.</span>
          </div>
        </aside>
      </div>
    </section>
  );
}
