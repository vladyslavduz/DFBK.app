import PageShell from '../components/PageShell';

export default function ProjectDetailPage({ id }: { id: string }) {
  return <PageShell eyebrow="Projekt" title={`Projekt ${id}`} intro="Detailansicht für Fotos, AI-Beschreibung, Publikationsvarianten und Veröffentlichungsstatus."><div className="result-grid"><div className="placeholder-card compact">[ Projekt-Galerie ]</div><div className="card"><h3>Projektinformationen</h3><p>[ Titel, Ort, Kategorie, Leistungen, Materialien, Datum ]</p><h3>Content</h3><p>[ Website-Text / Social-Text / Google Business ]</p><h3>Status</h3><p>[ Entwurf / Freigegeben / Veröffentlicht ]</p></div></div></PageShell>;
}
