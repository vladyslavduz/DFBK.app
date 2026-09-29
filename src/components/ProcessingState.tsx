import AppIcon from './AppIcon';

const stages = ['Foto verstehen', 'Informationen berücksichtigen', 'Inhalte erstellen'];

type Props = {
  error?: string;
  retrying?: boolean;
  onRetry?: () => void;
  onChangePhoto?: () => void;
  onReload?: () => void;
};

export default function ProcessingState({ error, retrying = false, onRetry, onChangePhoto, onReload }: Props) {
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
