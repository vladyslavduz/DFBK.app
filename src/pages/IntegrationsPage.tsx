import PageShell from '../components/PageShell';
import StatusBadge from '../components/StatusBadge';

const integrations = [
  ['Google Business Profile', 'Lokale Posts und Projekt-Updates', 'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET'],
  ['Instagram / Facebook', 'Posts über Meta APIs', 'META_APP_ID / META_APP_SECRET'],
  ['Telegram', 'Veröffentlichung in einem verbundenen Kanal', 'TELEGRAM_BOT_TOKEN'],
  ['Website / Blog', 'Projekt- und Blog-Inhalte an eigene Website', 'später definieren'],
  ['E-Mail', 'Bestätigung, Passwort-Reset und System-E-Mails', 'EMAIL_API_KEY'],
  ['Billing', 'Abonnement / Zahlungen', 'STRIPE_SECRET_KEY']
];

export default function IntegrationsPage() {
  return <PageShell eyebrow="Integrationen" title="Kanäle verbinden" intro="Alle Schnittstellen sind bewusst deaktiviert. Schlüssel gehören ausschließlich in Cloudflare Secrets."><div className="integration-list">{integrations.map(([name,desc,key]) => <article className="card integration-card" key={name}><div><h3>{name}</h3><p>{desc}</p><code>{key}</code></div><StatusBadge enabled={false} /></article>)}</div></PageShell>;
}
