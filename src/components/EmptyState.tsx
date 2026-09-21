import AppLink from './AppLink';
import AppIcon from './AppIcon';

export default function EmptyState() {
  return (
    <section className="empty-state">
      <div className="empty-state-copy">
        <span className="app-kicker">Dein erster Schritt</span>
        <h1>Willkommen bei DFBK.app</h1>
        <p>Mach aus deiner ersten Arbeit professionellen Content – ohne komplizierte Einstellungen.</p>
        <AppLink className="button app-primary-action" to="/app/new"><AppIcon name="plus" />Erstes Projekt erstellen</AppLink>
      </div>
      <ol className="empty-flow" aria-label="So funktioniert DFBK.app">
        <li><span><AppIcon name="camera" /></span><strong>Foto</strong></li>
        <li><span><AppIcon name="edit" /></span><strong>Beschreiben</strong></li>
        <li><span><AppIcon name="spark" /></span><strong>DFBK.app</strong></li>
        <li><span><AppIcon name="check" /></span><strong>Fertig</strong></li>
      </ol>
    </section>
  );
}
