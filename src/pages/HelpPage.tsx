import PageShell from '../components/PageShell';

export default function HelpPage() {
  return (
    <PageShell eyebrow="Hilfe" title="FAQ & Support" intro="Die wichtigsten Antworten zum aktuellen DFBK.app MVP.">
      <div className="steps">
        <article className="step">
          <span>1</span>
          <div>
            <h3>Wie starte ich?</h3>
            <p>Lade ein Foto deiner Arbeit hoch. Zusatzinfo ist optional und nur für Dinge gedacht, die auf dem Foto nicht erkennbar sind – zum Beispiel Material, Marke, Ort oder eine Besonderheit.</p>
          </div>
        </article>
        <article className="step">
          <span>2</span>
          <div>
            <h3>Was erstellt DFBK.app?</h3>
            <p>DFBK.app erstellt Inhalte für Google Business, Social Media und Website / Referenz. Dein Originalfoto bleibt erhalten; eine optimierte Bildversion wird separat angezeigt, wenn sie verfügbar ist.</p>
          </div>
        </article>
        <article className="step">
          <span>3</span>
          <div>
            <h3>Wie verwende ich das Ergebnis?</h3>
            <p>Du kannst Texte kopieren, Bilder herunterladen und mit einem aktiven DFBK-Zugang das native Teilen-Menü deines Geräts verwenden. Direkte automatische Veröffentlichungen zu Google oder Meta sind im aktuellen MVP noch nicht aktiv.</p>
          </div>
        </article>
      </div>
    </PageShell>
  );
}
