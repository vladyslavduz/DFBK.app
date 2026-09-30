import { pricingConfig } from '../../config/pricing';

export default function PricingFAQ() {
  return (
    <section className="pricing-v1-faq" aria-labelledby="pricing-faq-heading">
      <span className="pricing-v1-eyebrow">FAQ</span>
      <h3 id="pricing-faq-heading">Kurz erklärt</h3>
      <div className="pricing-v1-faq-list">
        {pricingConfig.faq.map(item => (
          <details key={item.question}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
