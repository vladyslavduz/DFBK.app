import AppIcon from '../components/AppIcon';

export default function BillingPage() {
  return (
    <div className="app-page billing-page">
      <header className="app-page-heading"><span className="app-kicker">Tarif</span><h1>Dein Tarif</h1><p>Hier siehst du deinen aktuellen Zugang zu DFBK.app.</p></header>
      <section className="plan-card"><div><span className="plan-icon"><AppIcon name="card" /></span><span className="app-kicker">Aktueller Tarif</span><h2>Kostenlos</h2><p>Du nutzt derzeit den Testzugang von DFBK.app.</p></div><ul><li><AppIcon name="check" />Persönlicher Bereich</li><li><AppIcon name="check" />Projekte vorbereiten</li><li><AppIcon name="check" />Inhalte ansehen und bearbeiten</li></ul><button className="button" type="button" disabled>Weitere Tarife folgen</button><small>Über neue Tarife, Preise und Leistungen informieren wir transparent, sobald sie verfügbar sind.</small></section>
    </div>
  );
}
