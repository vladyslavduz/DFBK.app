import AppIcon from './AppIcon';

const contentStages = ['Foto verstehen', 'Zusatzinfo berücksichtigen (falls vorhanden)', 'Inhalte erstellen'];
const createStages = ['Foto verstehen', 'Foto optimieren', 'Zusatzinfo berücksichtigen (falls vorhanden)', 'Inhalte erstellen'];

type Props = {
  error?: string;
  retrying?: boolean;
  includesPhotoOptimization?: boolean;
  onRetry?: () => void;
  onChangePhoto?: () => void;
  onReload?: () => void;
};

export default function ProcessingState({ error, retrying = false, includesPhotoOptimization = false, onRetry, onChangePhoto, onReload }: Props) {
  const stages = includesPhotoOptimization ? createStages : contentStages;
  return (
    <section className="wizard-card processing-state" aria-live="polite">
      <span className="processing-orb"><AppIcon name="spark" /></span>
      <span className="app-kicker">Schritt 3</span>
      <h1>DFBK.app erstellt deinen Content</h1>
      <p>Du kannst dich kurz zurücklehnen. Wir bereiten alles übersichtlich für dich vor.</p>
      <ol>{stages.map((stage, index) => <li key={stage}><span>{index + 1}</span>{stage}</li>)}</ol>
      {error && <div className="processing-error" role="alert"><p>{error}</p><div>{onChangePhoto && <button className="button button-secondary" type="button" disabled={retrying} onClick={onChangePhoto}>Foto ändern</button>}{onRetry && <button className="button" type="button" disabled={retrying} onClick={onRetry}>{retrying ? 'Wird erneut versucht…' : 'Erneut versuchen'}</button>}{onReload && <button className="button button-secondary" type="button" disabled={retrying} onClick={onReload}>Status aktualisieren</button>}</div></div>}
      {!error && onReload && <button className="button button-secondary" type="button" disabled={retrying} onClick={onReload}>Status aktualisieren</button>}
    </section>
  );
}
