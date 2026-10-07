import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../components/AppIcon';
import { useSocialPublishing, connectionForProvider } from '../contexts/SocialPublishingContext';
import { navigate } from '../lib/router';
import type { SocialProvider } from '../services/social';

const providers: Array<{ id: SocialProvider; label: string; icon: string }> = [
  { id: 'instagram', label: 'Instagram', icon: '/visual/integrations/icons/instagram.svg' },
  { id: 'facebook', label: 'Facebook', icon: '/visual/integrations/icons/facebook.svg' },
  { id: 'linkedin', label: 'LinkedIn', icon: '/visual/integrations/icons/linkedin.svg' },
  { id: 'x', label: 'X', icon: '/visual/integrations/icons/x.svg' },
];

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
      if (draft?.projectId) navigate(`/app/projects/${draft.projectId}?publish=resume`);
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
    <div className="app-page social-integrations-page">
      <header className="app-page-heading">
        <span className="app-kicker">Integrationen</span>
        <h1>Social Media verbinden</h1>
        <p>Verbinde genau die Konten, auf denen du später ausdrücklich veröffentlichen möchtest.</p>
      </header>

      {socialHint === 'cancelled' && <p className="inline-notice">Verbindung wurde abgebrochen.</p>}
      {socialHint === 'failed' && <p className="inline-notice">Die Verbindung konnte nicht abgeschlossen werden.</p>}
      {socialHint === 'no_accounts' && <p className="inline-notice">Es wurde kein unterstütztes Konto gefunden.</p>}
      {socialHint === 'permission_required' && <p className="inline-notice">Für die Verbindung fehlen notwendige Berechtigungen.</p>}
      {socialHint === 'select_account' && <p className="inline-notice">Wähle jetzt das gewünschte Konto aus. Es wird nichts automatisch veröffentlicht.</p>}
      {actionError && <p className="auth-error" role="alert">{actionError}</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      {unavailable && <p className="inline-notice">Social Publishing ist auf diesem System noch nicht aktiviert. Es werden keine Verbindungen simuliert.</p>}

      <div className="social-connection-grid">
        {providers.map(provider => {
          const connection = connectionForProvider(connections, provider.id);
          const isMeta = provider.id === 'instagram' || provider.id === 'facebook';
          const metaProvider: 'instagram' | 'facebook' | null = isMeta ? provider.id : null;
          const pendingAccounts = connection?.accounts.filter(account => account.status === 'pending') || [];
          const showCandidates = socialHint === 'select_account' && providerHint === provider.id && pendingAccounts.length > 0;

          return (
            <article className="social-connection-card" key={provider.id}>
              <div className="social-provider-heading">
                <img src={provider.icon} alt="" />
                <div>
                  <strong>{provider.label}</strong>
                  <span>{connection?.connected && connection.accountName ? connection.accountName : availabilityText(provider.id, connection?.availability)}</span>
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

              <div className="social-connection-actions">
                {isMeta && connection?.availability === 'available' && connection.status === 'reconnect_required' && !showCandidates && (
                  <button className="button" type="button" onClick={() => connect(metaProvider!)}>Erneut verbinden</button>
                )}
                {isMeta && connection?.availability === 'available' && connection.status === 'not_connected' && !showCandidates && (
                  <button className="button" type="button" onClick={() => connect(metaProvider!)}>Verbinden</button>
                )}
                {isMeta && connection?.connected && (
                  <button className="button button-secondary" type="button" onClick={() => void remove(metaProvider!)}>Verbindung trennen</button>
                )}
                {(!connection || connection.availability !== 'available') && <span className="mvp-integration-status">{availabilityText(provider.id, connection?.availability)}</span>}
              </div>
            </article>
          );
        })}
      </div>

      {loading && <p className="settings-hint" role="status">Verbindungen werden aktualisiert …</p>}
    </div>
  );
}
