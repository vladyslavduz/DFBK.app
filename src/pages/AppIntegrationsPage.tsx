import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../components/AppIcon';
import { useSocialPublishing, connectionForProvider } from '../contexts/SocialPublishingContext';
import { navigate } from '../lib/router';
import type { SocialProvider } from '../services/social';
import { integrationChannels } from '../config/integrations';
import { cmsPlatforms } from '../services/promo-share';
import { useUserArea } from '../contexts/UserAreaContext';
import '../styles/channels-integrations.css';

function availabilityText(provider: SocialProvider, availability?: string) {
  if (provider === 'linkedin' || provider === 'x') return 'In Vorbereitung';
  if (availability === 'available') return 'Verfügbar';
  if (availability === 'not_configured') return 'Noch nicht konfiguriert';
  return 'In Vorbereitung';
}

export default function AppIntegrationsPage() {
  const {
    connections,
    loading,
    unavailable,
    error,
    refreshConnections,
    connect,
    selectAccount,
    disconnect,
    draft,
  } = useSocialPublishing();
  const [actionError, setActionError] = useState('');
  const { projects, projectsLoading, projectsError, reloadProjects } = useUserArea();
  const [selectedProject, setSelectedProject] = useState('');
  const [cms, setCms] = useState<string>(cmsPlatforms[0]);
  const [helpChannel, setHelpChannel] = useState<string | null>(null);
  // A project is chosen explicitly; never substitute the most recent project.
  const project = projects.find(item => item.id === selectedProject);
  function prepare() {
    if (project) navigate(`/app/projects/${encodeURIComponent(project.id)}/publish`);
    else document.getElementById('integration-project')?.focus();
  }
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const socialHint = params.get('social');
  const providerHint = params.get('provider') as SocialProvider | null;

  useEffect(() => {
    void refreshConnections();
  }, [refreshConnections]);

  async function choose(provider: 'instagram' | 'facebook', connectionId: string) {
    setActionError('');
    try {
      await selectAccount(provider, connectionId);
      window.history.replaceState({}, '', '/app/integrations');
      if (draft?.projectId) navigate(`/app/projects/${encodeURIComponent(draft.projectId)}/publish`);
    } catch {
      setActionError('Das Konto konnte nicht ausgewählt werden. Bitte versuche es erneut.');
    }
  }

  async function remove(provider: 'instagram' | 'facebook') {
    setActionError('');
    try {
      await disconnect(provider);
    } catch {
      setActionError('Die Verbindung konnte nicht getrennt werden.');
    }
  }

  return (
    <div className="app-page social-integrations-page channels-integrations">
      <header className="app-page-heading">
        <span className="app-kicker">Integrationen</span>
        <h1>Deine Kanäle</h1>
        <p>Bereite Projektmaterialien vor oder verwalte unterstützte API-Verbindungen. Du bestätigst jede Veröffentlichung ausdrücklich.</p>
      </header>

      {socialHint === 'cancelled' && <p className="inline-notice">Verbindung wurde abgebrochen.</p>}
      {socialHint === 'failed' && <p className="inline-notice">Die Verbindung konnte nicht abgeschlossen werden.</p>}
      {socialHint === 'no_accounts' && <p className="inline-notice">Es wurde kein unterstütztes Konto gefunden.</p>}
      {socialHint === 'permission_required' && <p className="inline-notice">Für die Verbindung fehlen notwendige Berechtigungen.</p>}
      {socialHint === 'select_account' && <p className="inline-notice">Wähle jetzt das gewünschte Konto aus. Es wird nichts automatisch veröffentlicht.</p>}
      {actionError && <p className="auth-error" role="alert">{actionError}</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      {unavailable && <p className="inline-notice">Social Publishing ist auf diesem System noch nicht aktiviert. Es werden keine Verbindungen simuliert.</p>}

      <section className="channels-materials" aria-labelledby="channels-materials-heading">
        <h2 id="channels-materials-heading">Materialien eines Projekts vorbereiten</h2>
        <label htmlFor="integration-project">Projekt auswählen<select id="integration-project" value={project?.id || ''} onChange={event => setSelectedProject(event.target.value)} disabled={projectsLoading}>
          <option value="">{projectsLoading ? 'Projekte werden geladen …' : 'Bitte ein Projekt auswählen'}</option>
          {projects.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select></label>
        {projectsError && <><p role="alert">{projectsError}</p><button type="button" onClick={() => void reloadProjects()}>Projekte erneut laden</button></>}
        {!projectsLoading && !projectsError && !projects.length && <button className="button" type="button" onClick={() => navigate('/app/new')}>Erstes Projekt erstellen</button>}
        <p className="channels-help">Im gewählten Projekt prüfst du Bild und Text pro Kanal. Download, Kopieren und System-Teilen sind von einer API-Verbindung unabhängig und bestätigen keine Veröffentlichung.</p>
      </section>
      <div className="social-connection-grid">
        {integrationChannels.map(provider => {
          const connection = provider.connectionProvider ? connectionForProvider(connections, provider.connectionProvider) : null;
          const isMeta = provider.id === 'instagram' || provider.id === 'facebook';
          const metaProvider: 'instagram' | 'facebook' | null =
            provider.id === 'instagram' || provider.id === 'facebook' ? provider.id : null;
          const pendingAccounts = connection?.accounts.filter(account => account.status === 'pending') || [];
          const showCandidates = socialHint === 'select_account' && providerHint === provider.id && pendingAccounts.length > 0;

          return (
            <article className="social-connection-card" key={provider.id} aria-label={provider.label} data-channel={provider.id}>
              <div className="social-provider-heading">
                <img src={'/visual/integrations/icons/' + provider.icon} alt="" />
                <div>
                  <strong>{provider.label}</strong>
                  <span>{connection?.connected && connection.accountName ? connection.accountName : provider.connectionProvider ? availabilityText(provider.connectionProvider, connection?.availability) : 'Manuelle Übergabe / Export'}</span>
                </div>
                {connection?.connected && <span className="project-status status-ready"><AppIcon name="check" />Verbunden</span>}
              </div>

              {showCandidates && isMeta && (
                <div className="social-account-list">
                  <strong>Konto auswählen</strong>
                  {pendingAccounts.map(account => (
                    <button type="button" onClick={() => void choose(metaProvider!, account.connectionId)} key={account.connectionId}>
                      <span>{account.accountName}</span>
                      <small>Auswählen</small>
                    </button>
                  ))}
                </div>
              )}

              <p className="channels-help">{isMeta ? 'API-Verbindung: Kontostatus siehe oben. Materialien kannst du auch manuell verwenden.' : provider.id === 'website' ? 'CMS wählen und Bild sowie Text manuell im eigenen Editor übernehmen. Kein direkter CMS-Connector aktiv.' : 'Bild und Text manuell übernehmen. Automatische Veröffentlichung ist hier nicht eingerichtet.'}</p>
              {provider.id === 'website' && <div className="channels-cms">
                <label>Website-Plattform<select value={cms} onChange={event => setCms(event.target.value)}>{cmsPlatforms.map(name => <option key={name}>{name}</option>)}</select></label>
                <p className="channels-help">Für {cms}: Öffne die Materialien deines gewählten Projekts, wähle Website / Blog, lade das Bild herunter und kopiere den Text in deinen Editor. Dort prüfst und veröffentlichst du selbst. Die Plattformwahl verbindet kein Konto.</p>
              </div>}
              <div className="social-connection-actions">
                <button className="button button-secondary" type="button" onClick={prepare}>{project ? 'Projektmaterialien öffnen' : 'Projekt für Materialien wählen'}</button>
                {!isMeta && <button className="button button-secondary" type="button" aria-expanded={helpChannel === provider.id} onClick={() => setHelpChannel(helpChannel === provider.id ? null : provider.id)}>Automatisierung: Voraussetzungen</button>}
                {isMeta && connection?.availability === 'available' && connection.status === 'reconnect_required' && !showCandidates && (
                  <button className="button" type="button" onClick={() => connect(metaProvider!)}>Erneut verbinden</button>
                )}
                {isMeta && connection?.availability === 'available' && connection.status === 'not_connected' && !showCandidates && (
                  <button className="button" type="button" onClick={() => connect(metaProvider!)}>Verbinden</button>
                )}
                {isMeta && connection?.connected && (
                  <button className="button button-secondary" type="button" onClick={() => void remove(metaProvider!)}>Verbindung trennen</button>
                )}
                {(!connection || connection.availability !== 'available') && <span className="mvp-integration-status">{provider.connectionProvider ? availabilityText(provider.connectionProvider, connection?.availability) : 'Manuelle Übergabe / Export'}</span>}
              </div>
              {helpChannel === provider.id && <p className="inline-notice">Für {provider.label} ist hier kein automatischer Versand freigeschaltet. Dafür sind ein unterstützter Connector, ein autorisiertes Zielkonto und bestätigte Berechtigungen erforderlich. Manuelle Übergabe bleibt über die Projektmaterialien verfügbar; Dateien werden beim Öffnen eines Dienstes nicht automatisch hochgeladen.</p>}
            </article>
          );
        })}
      </div>

      <section className="inline-notice channels-planner" aria-labelledby="channels-planner-heading"><h2 id="channels-planner-heading">Veröffentlichungsplaner · in Vorbereitung</h2><p>Geplante autonome Veröffentlichungen sind noch nicht verfügbar. Aktuell kannst du Materialien vorbereiten und selbst übergeben. Hier wird kein Termin gespeichert oder Beitrag automatisch versendet.</p></section>
      {loading && <p className="settings-hint" role="status">Verbindungen werden aktualisiert …</p>}
    </div>
  );
}
