export default function PricingValueBlock() {
  return (
    <section className="pricing-v1-value-block" aria-labelledby="pricing-value-heading">
      <div>
        <span className="pricing-v1-eyebrow">ZEIT STATT MARKETING-STRESS</span>
        <h3 id="pricing-value-heading">Was kostet dich dein Marketing heute?</h3>
        <p>Mehr Zeit für deine Arbeit. Weniger Zeit fürs Marketing.</p>
      </div>
      <div className="pricing-v1-value-grid">
        <article><strong>Selbst machen</strong><span>→ Zeit nach Feierabend</span></article>
        <article><strong>Agentur / Freelancer</strong><span>→ laufende Kosten</span></article>
        <article className="is-dfbk"><strong>DFBK.app</strong><span>→ Foto hochladen</span><span>→ Inhalt prüfen</span><span>→ verwenden</span></article>
      </div>
    </section>
  );
}
