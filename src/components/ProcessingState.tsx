import { useEffect, useState } from 'react';
import AppIcon from './AppIcon';

const stages = ['Foto verstehen', 'Informationen berücksichtigen', 'Inhalte erstellen'];

type Props = {
  onComplete: () => void;
  error?: string;
  retrying?: boolean;
  onRetry?: () => void;
  onChangePhoto?: () => void;
};

export default function ProcessingState({ onComplete, error, retrying = false, onRetry, onChangePhoto }: Props) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const stageTimer = window.setInterval(() => setActive(current => Math.min(current + 1, stages.length - 1)), 900);
    const completeTimer = window.setTimeout(onComplete, 3100);
    return () => { window.clearInterval(stageTimer); window.clearTimeout(completeTimer); };
  }, [onComplete]);

  return (
    <section className="wizard-card processing-state" aria-live="polite">
      <span className="processing-orb"><AppIcon name="spark" /></span>
      <span className="app-kicker">Schritt 3</span>
      <h1>DFBK.app erstellt deinen Content</h1>
      <p>Du kannst dich kurz zurücklehnen. Wir bereiten alles übersichtlich für dich vor.</p>
      <ol>{stages.map((stage, index) => <li className={index <= active ? 'is-active' : ''} key={stage}><span>{index < active ? <AppIcon name="check" /> : index + 1}</span>{stage}</li>)}</ol>
      {error && <div className="processing-error" role="alert"><p>{error}</p><div>{onChangePhoto && <button className="button button-secondary" type="button" disabled={retrying} onClick={onChangePhoto}>Foto ändern</button>}{onRetry && <button className="button" type="button" disabled={retrying} onClick={onRetry}>{retrying ? 'Wird erneut versucht…' : 'Erneut versuchen'}</button>}</div></div>}
    </section>
  );
}
