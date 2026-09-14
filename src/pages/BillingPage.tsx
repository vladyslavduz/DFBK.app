import PageShell from '../components/PageShell';

export default function BillingPage() {
  return <PageShell eyebrow="Abonnement" title="Billing" intro="Zahlungen sind im Karcass vorgesehen, aber für den ersten Produkttest deaktiviert."><div className="card"><h3>DFBK Starter</h3><p>Status: Kein aktives Abonnement.</p><button className="button" disabled>Checkout — Payment API noch nicht verbunden</button></div></PageShell>;
}
