import PageShell from '../components/PageShell';

export default function HelpPage() {
  return <PageShell eyebrow="Hilfe" title="FAQ & Support"><div className="steps"><article className="step"><span>1</span><div><h3>Wie starte ich?</h3><p>Foto hochladen, kurze Notiz ergänzen und später AI-Inhalt generieren.</p></div></article><article className="step"><span>2</span><div><h3>Wo sind meine API-Schlüssel?</h3><p>Niemals im Browser oder GitHub. Sie werden später als Cloudflare Secrets hinterlegt.</p></div></article><article className="step"><span>3</span><div><h3>Wie wird veröffentlicht?</h3><p>Nach Freigabe über die jeweilige offizielle Plattform-API.</p></div></article></div></PageShell>;
}
