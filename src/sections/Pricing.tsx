import AppLink from '../components/AppLink';
import PricingCard from '../components/pricing/PricingCard';
import PricingFAQ from '../components/pricing/PricingFAQ';
import PricingOutcome from '../components/pricing/PricingOutcome';
import PricingValueBlock from '../components/pricing/PricingValueBlock';
import { pricingConfig } from '../config/pricing';

type Props = { standalone?: boolean };

export default function Pricing({ standalone = false }: Props) {
  return (
    <section id="pricing" className={`section pricing-v1${standalone ? ' pricing-v1-page' : ' section-muted'}`}>
      <div className="container pricing-v1-container">
        <header className="pricing-v1-header">
          <span className="eyebrow">Tarife</span>
          <h2>{pricingConfig.headline}</h2>
          <p>{pricingConfig.subtitle}</p>
          <div className="pricing-v1-trust" aria-label="Vorteile">
            {pricingConfig.trustLine.map(item => <span key={item}>{item}</span>)}
            <span>Für kleine Betriebe gemacht</span>
          </div>
        </header>

        <div className="pricing-v1-grid">
          {pricingConfig.plans.map(plan => <PricingCard plan={plan} key={plan.id} />)}
        </div>

        <PricingValueBlock />
        <PricingOutcome />

        <div className="pricing-v1-trust-strip" aria-label="Einfacher Einstieg">
          <span>Einfach ausprobieren</span>
          <span>Keine komplizierte Einrichtung</span>
          <span>Für kleine Betriebe gemacht</span>
          <span>Tarif später wählen</span>
        </div>

        <PricingFAQ />

        <section className="pricing-v1-final" aria-labelledby="pricing-final-heading">
          <span className="pricing-v1-eyebrow">BEREIT?</span>
          <h3 id="pricing-final-heading">Bereit, deine Arbeit sichtbar zu machen?</h3>
          <p>Du machst die Arbeit. DFBK.app macht sie sichtbar.</p>
          <div className="pricing-v1-final-actions">
            <AppLink className="button" to="/register">Ausprobieren</AppLink>
            <AppLink className="button button-secondary" to="/#how">So funktioniert DFBK.app</AppLink>
          </div>
        </section>
      </div>
    </section>
  );
}
