import PageShell from '../components/PageShell';

export default function ResultPage() {
  return <PageShell eyebrow="AI Ergebnis" title="Vorschau & Freigabe" intro="Diese Seite ist für das spätere AI-Ergebnis vorbereitet."><div className="result-grid"><div className="placeholder-card compact">[ Bearbeitetes Projektfoto ]</div><div className="card"><h3>Erkannte Arbeit</h3><p>[ AI Analyse: Gewerk, Arbeit, Materialien, Kontext ]</p><h3>Social Post</h3><textarea readOnly value="[ Generierter Social-Media-Text ]" /><h3>Google Business</h3><textarea readOnly value="[ Generierter Google-Business-Text ]" /><div className="actions"><button className="button" disabled>Speichern</button><button className="button button-secondary" disabled>Veröffentlichen</button></div></div></div></PageShell>;
}
