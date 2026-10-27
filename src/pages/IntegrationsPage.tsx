import PageShell from '../components/PageShell';
import IntegrationDemo from '../components/IntegrationDemo';
import PublishingPanel from '../components/PublishingPanel';
import { promoImage, promoTexts, promoVideos } from '../config/publishing';
import '../styles/integrations-share.css';
export default function IntegrationsPage() {
  return <PageShell eyebrow="Integrationen" title="Dein Content. Deine Kanäle." intro="Entdecke DFBK und bereite einen Beitrag über unseren Service vor.">
    <IntegrationDemo />
    <div className="share-hub__package"><div className="share-hub__preview"><img className="share-hub__preview-bg" src={promoImage} alt="" aria-hidden="true" /><img className="share-hub__preview-main" src={promoImage} alt="Beispiel eines optimierten DFBK Projektfotos" /></div>
      <div className="share-hub__message"><h3>Du machst die Arbeit. DFBK macht sie sichtbar.</h3><p>Aus deinem Arbeitsfoto werden ein optimiertes Bild und Marketingtexte. Ergebnis prüfen und für deine Kanäle verwenden.</p><a href="https://dfbk.app">dfbk.app</a></div></div>
    <PublishingPanel title="DFBK.app – Dein Foto bringt Kunden." imageUrl={promoImage} texts={promoTexts} videoUrl={promoVideos[0].url} squareVideoUrl={promoVideos[1].url} />
  </PageShell>;
}
