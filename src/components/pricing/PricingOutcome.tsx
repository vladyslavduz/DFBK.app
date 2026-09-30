export default function PricingOutcome() {
  return (
    <section className="pricing-v1-outcome" aria-labelledby="pricing-outcome-heading">
      <div className="pricing-v1-outcome-copy">
        <span className="pricing-v1-eyebrow">WAS DU BEKOMMST</span>
        <h3 id="pricing-outcome-heading">Eine Arbeit. Mehrere Möglichkeiten, sichtbar zu werden.</h3>
      </div>
      <div className="pricing-v1-outcome-flow" aria-label="Foto wird mit DFBK.app zu Inhalten für mehrere Kanäle">
        <div className="pricing-v1-flow-node">FOTO</div>
        <span className="pricing-v1-flow-arrow" aria-hidden="true">↓</span>
        <div className="pricing-v1-flow-node is-dfbk">DFBK.app</div>
        <div className="pricing-v1-flow-channels">
          <span>Google</span>
          <span>Website</span>
          <span>Social Media</span>
        </div>
      </div>
    </section>
  );
}
