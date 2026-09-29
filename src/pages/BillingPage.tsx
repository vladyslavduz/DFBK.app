import AppIcon from '../components/AppIcon';
import { useUserArea } from '../contexts/UserAreaContext';

export default function BillingPage() {
  const { plan, planLoading, planError, reloadPlan } = useUserArea();
  const businessActive = plan.plan === 'business' && plan.status === 'active';

  return (
    <div className="app-page billing-page">
      <header className="app-page-heading"><span className="app-kicker">Tarif</span><h1>Dein Zugang</h1><p>Hier siehst du deinen aktuellen Zugang zu DFBK.app.</p></header>
      <section className="plan-card plan-card-current"><div><span className="plan-icon"><AppIcon name="card" /></span><span className="app-kicker">Aktueller Tarif</span><h2>{plan.displayName}</h2><p>{businessActive ? 'Business ist für dieses Konto freigeschaltet.' : 'Dein Testzugang ist bereit für die ersten Projekte.'}</p>{planLoading && <small className="plan-loading">Tarif wird geprüft …</small>}{planError && <small className="plan-error" role="status">{planError}</small>}</div><ul><li><AppIcon name="check" />Persönlicher Bereich</li><li><AppIcon name="check" />Projekte vorbereiten</li><li><AppIcon name="check" />Inhalte ansehen und bearbeiten</li><li className={plan.voice.enabled ? '' : 'is-muted'}><AppIcon name={plan.voice.enabled ? 'check' : 'settings'} />{plan.voice.enabled ? plan.voice.maxWords ? `Spracheingabe bis ${plan.voice.maxWords} Wörter` : 'Unbegrenzte Spracheingabe' : 'Spracheingabe noch nicht freigeschaltet'}</li></ul><button className="button" type="button" onClick={() => void reloadPlan()} disabled={planLoading}>Status aktualisieren</button><small>Business wird derzeit manuell durch den Administrator freigeschaltet. Preise und automatische Zahlung folgen später.</small></section>
      <section className="plan-options" aria-label="Verfügbare Tarife"><article className={`plan-option${plan.plan === 'trial' ? ' is-current' : ''}`}><span className="app-kicker">Tarif 1</span><h2>Testzugang</h2><p>Für erste Projekte und eine begrenzte Spracheingabe.</p><strong>{plan.voice.maxWords ? `${plan.voice.maxWords} Wörter pro Spracheingabe` : 'Spracheingabe nach Freischaltung'}</strong><span className="plan-option-status">{plan.plan === 'trial' ? 'Aktueller Tarif' : 'Verfügbar'}</span></article><article className={`plan-option plan-option-business${businessActive ? ' is-current' : ''}`}><span className="app-kicker">Tarif 2</span><h2>Business</h2><p>Für den regulären Arbeitsalltag mit voller Spracheingabe.</p><strong>Manuelle Freischaltung</strong><span className="plan-option-status">{businessActive ? 'Aktiv' : 'Auf Anfrage'}</span></article></section>
    </div>
  );
}
