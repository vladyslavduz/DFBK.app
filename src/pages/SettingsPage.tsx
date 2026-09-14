import PageShell from '../components/PageShell';

export default function SettingsPage() {
  return <PageShell eyebrow="Einstellungen" title="DFBK Einstellungen"><div className="cards"><article className="card"><h3>Sprache</h3><p>Standard: Deutsch. Weitere Sprachen später.</p></article><article className="card"><h3>AI-Vorgaben</h3><p>Ton, Länge, CTA, Hashtags und Freigabe-Regeln.</p></article><article className="card"><h3>Datenschutz</h3><p>Datenexport, Löschung und Einwilligungen werden serverseitig ergänzt.</p></article></div></PageShell>;
}
