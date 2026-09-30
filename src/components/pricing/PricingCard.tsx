import AppLink from '../AppLink';
import { pricingConfig } from '../../config/pricing';

type Props = { plan: (typeof pricingConfig.plans)[number] };

export default function PricingCard({ plan }: Props) {
  const isPro = plan.id === 'pro';

  return (
    <article className={`pricing-v1-card${isPro ? ' is-pro' : ''}`}>
      <div className="pricing-v1-card-topline">
        <span className="pricing-v1-eyebrow">{plan.eyebrow}</span>
        {'badge' in plan && plan.badge && <span className="pricing-v1-badge">{plan.badge}</span>}
      </div>
      <h3>{plan.name}</h3>
      <p className="pricing-v1-value">{plan.value}</p>
      <p className="pricing-v1-description">{plan.description}</p>

      {isPro && (
        <div className="pricing-v1-price" aria-label="Preis noch nicht festgelegt">
          {plan.price ? <><strong>{plan.price}</strong><span>/ {plan.billingPeriod}</span></> : <strong>Preis folgt</strong>}
        </div>
      )}

      <ul className="pricing-v1-features">
        {plan.features.map(feature => (
          <li key={feature.label} className={feature.availability === 'planned' ? 'is-planned' : ''}>
            <span aria-hidden="true">✓</span>{feature.label}
            {feature.availability === 'planned' && <small>in Vorbereitung</small>}
          </li>
        ))}
      </ul>

      <div className="pricing-v1-card-footer">
        <p>{plan.audience}</p>
        <AppLink className={`button pricing-v1-cta${isPro ? '' : ' button-secondary'}`} to={plan.ctaTo}>{plan.cta}</AppLink>
        {plan.note && <small>{plan.note}</small>}
      </div>
    </article>
  );
}
