import PageShell from '../components/PageShell';

const legal = {
  impressum: ['Impressum', '[ Rechtlich geprüfte Unternehmensangaben hier einsetzen. ]'],
  datenschutz: ['Datenschutzerklärung', '[ DSGVO-konforme Datenschutzerklärung nach Festlegung aller Anbieter, Auftragsverarbeiter, Cookies und Datenflüsse einsetzen. ]'],
  agb: ['Allgemeine Geschäftsbedingungen', '[ AGB vor kommerziellem Start rechtlich prüfen und hier einsetzen. ]'],
  widerruf: ['Widerrufsbelehrung', '[ Für das konkrete B2B/B2C-Modell rechtlich prüfen und hier einsetzen. ]']
} as const;

export default function LegalPage({ type }: { type: keyof typeof legal }) {
  const [title, text] = legal[type];
  return <PageShell eyebrow="Rechtliches" title={title}><div className="legal-copy"><p>{text}</p><p><strong>Wichtig:</strong> Dies ist nur ein technischer Platzhalter und kein Rechtstext.</p></div></PageShell>;
}
