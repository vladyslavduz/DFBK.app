import AppLink from '../AppLink';

type Props = {
  imageUrl?: string;
  onLater?: () => void;
};

export default function UpgradePrompt({ imageUrl, onLater }: Props) {
  return (
    <section className="upgrade-prompt" aria-labelledby="upgrade-prompt-heading">
      <div className="upgrade-prompt-copy">
        <span className="pricing-v1-eyebrow">DEIN ERGEBNIS</span>
        <h2 id="upgrade-prompt-heading">Dein erstes Projekt ist fertig.</h2>
        <p>Darauf kannst du mit Business aufbauen.</p>
        <ul>
          <li>✓ Inhalte für mehrere Kanäle</li>
          <li>✓ Projekte und Referenzen im Blick behalten</li>
          <li>✓ Unbegrenzte Spracheingabe im Business-Zugang</li>
          <li>✓ Weitere Business-Funktionen, sobald sie verfügbar sind</li>
        </ul>
        <div className="upgrade-prompt-actions">
          <AppLink className="button" to="/pricing">Business ansehen</AppLink>
          {onLater ? <button className="button button-secondary" type="button" onClick={onLater}>Später entscheiden</button> : <AppLink className="button button-secondary" to="/app">Später entscheiden</AppLink>}
        </div>
      </div>
      {imageUrl && <div className="upgrade-prompt-result"><img src={imageUrl} alt="Dein fertiges Projekt" /></div>}
    </section>
  );
}
