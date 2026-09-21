import { useEffect, useState } from 'react';
import AppIcon from './AppIcon';

const stages = ['Foto verstehen', 'Informationen berücksichtigen', 'Inhalte erstellen'];

export default function ProcessingState({ onComplete }: { onComplete: () => void }) {
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
    </section>
  );
}
