import { useEffect, useMemo, useRef, useState } from 'react';
import AppIcon from './AppIcon';
import { ApiError } from '../lib/api';
import { getProjectMediaUrl, projectService } from '../services/projects';
import { connectionForProvider, useSocialPublishing } from '../contexts/SocialPublishingContext';
import type { ProjectMediaRef } from '../types/models';
import type { PublicationResult, PublishPayload } from '../services/social';

type Provider = 'instagram' | 'facebook';
type Phase = 'select' | 'preview' | 'confirm' | 'result';

type Props = {
  projectId: string;
  projectTitle?: string;
  initialCaption: string;
  onClose: () => void;
};

const providerMeta: Record<Provider, { label: string; icon: string }> = {
  instagram: { label: 'Instagram', icon: '/visual/integrations/icons/instagram.svg' },
  facebook: { label: 'Facebook', icon: '/visual/integrations/icons/facebook.svg' },
};

function errorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return 'Verbindung zum Server unterbrochen. Der Status ist möglicherweise noch nicht eindeutig.';
  if (error.code === 'SOCIAL_NOT_CONNECTED') return 'Das gewählte Social-Media-Konto ist nicht verbunden.';
  if (['SOCIAL_TOKEN_EXPIRED', 'RECONNECT_REQUIRED'].includes(error.code)) return 'Die Verbindung ist abgelaufen. Bitte verbinde das Konto erneut.';
  if (error.code === 'SOCIAL_PERMISSION_REQUIRED') return 'Notwendige Berechtigungen fehlen.';
  if (['SOCIAL_MEDIA_NOT_AVAILABLE', 'SOCIAL_MEDIA_UNSUPPORTED'].includes(error.code)) return 'Dieses Bild kann für den gewählten Kanal nicht veröffentlicht werden.';
  if (error.code === 'SOCIAL_RATE_LIMITED') return 'Bitte warte kurz und versuche es später erneut.';
  if (['SOCIAL_NOT_CONFIGURED', 'SOCIAL_PROVIDER_NOT_AVAILABLE'].includes(error.code)) return 'Dieser Kanal ist noch nicht verfügbar.';
  if (error.code === 'IDEMPOTENCY_CONFLICT') return 'Der gespeicherte Veröffentlichungsversuch passt nicht mehr zu diesem Beitrag.';
  if (error.code === 'INVALID_CAPTION') return 'Bitte prüfe die Länge des Textes.';
  return 'Die Veröffentlichung konnte nicht abgeschlossen werden.';
}

function safeProviderUrl(provider: Provider, value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase();
    if (provider === 'instagram' && (host === 'instagram.com' || host.endsWith('.instagram.com'))) return url.toString();
    if (provider === 'facebook' && (host === 'facebook.com' || host.endsWith('.facebook.com') || host === 'fb.com' || host.endsWith('.fb.com'))) return url.toString();
  } catch {}
  return null;
}

export default function SocialPublishModal({ projectId, projectTitle, initialCaption, onClose }: Props) {
  const {
    connections,
    loading,
    unavailable,
    refreshConnections,
    connect,
    publish,
    getPublication,
    draft,
    saveDraft,
    attempt,
    saveAttempt,
  } = useSocialPublishing();
  const [phase, setPhase] = useState<Phase>('select');
  const [caption, setCaption] = useState(initialCaption);
  const [selectedProviders, setSelectedProviders] = useState<Provider[]>([]);
  const [media, setMedia] = useState<{ original: ProjectMediaRef | null; optimized: ProjectMediaRef | null } | null>(null);
  const [useOptimized, setUseOptimized] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<PublicationResult[]>([]);
  const [message, setMessage] = useState('');
  const [requestId, setRequestId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    void refreshConnections();
    void projectService.getProjectMedia(projectId).then(state => {
      if (!mountedRef.current) return;
      setMedia(state.media);
      setUseOptimized(Boolean(state.media.optimized));
    }).catch(() => setMessage('Das Projektbild konnte nicht geladen werden.'));
    return () => { mountedRef.current = false; };
  }, [projectId, refreshConnections]);

  useEffect(() => {
    if (draft?.projectId !== projectId) return;
    setCaption(draft.caption || initialCaption);
    setSelectedProviders(draft.providers);
    setUseOptimized(draft.useOptimizedImage);
    if (draft.providers.length) setPhase('preview');
  }, [draft, initialCaption, projectId]);

  const selectedMedia = useOptimized && media?.optimized ? media.optimized : media?.original;
  const captionLimit = selectedProviders.includes('instagram') ? 2200 : 5000;
  const captionLength = Array.from(caption.trim()).length;
  const instagramMimeBlocked = selectedProviders.includes('instagram') && selectedMedia?.mimeType !== 'image/jpeg';

  function persistDraft(nextProviders = selectedProviders, nextCaption = caption, nextOptimized = useOptimized) {
    saveDraft({
      projectId,
      caption: nextCaption,
      providers: nextProviders,
      mediaId: selectedMedia?.id || null,
      useOptimizedImage: nextOptimized,
    });
  }

  function toggleProvider(provider: Provider) {
    const connection = connectionForProvider(connections, provider);
    if (!connection?.connected) return;
    const next = selectedProviders.includes(provider)
      ? selectedProviders.filter(item => item !== provider)
      : [...selectedProviders, provider];
    setSelectedProviders(next);
    persistDraft(next);
  }

  function goPreview() {
    if (!selectedProviders.length || !selectedMedia) return;
    persistDraft();
    setMessage('');
    setPhase('preview');
  }

  function freezePayload(): PublishPayload | null {
    if (!selectedMedia || !selectedProviders.length) return null;
    return {
      providers: [...selectedProviders].sort() as Provider[],
      caption: caption.trim(),
      useOptimizedImage: Boolean(useOptimized && media?.optimized),
      mediaId: selectedMedia.id,
    };
  }

  async function submitExact(existing = false) {
    const payload = existing && attempt?.projectId === projectId ? attempt.payload : freezePayload();
    if (!payload) return;
    const key = existing && attempt?.projectId === projectId ? attempt.key : crypto.randomUUID();

    setSubmitting(true);
    setMessage(existing ? 'Der bestehende Veröffentlichungsversuch wird sicher fortgesetzt …' : 'Wird veröffentlicht …');
    if (!existing) {
      saveAttempt({ projectId, key, payload, requestId: null });
    }

    try {
      const response = await publish(projectId, payload, key);
      if (!mountedRef.current) return;
      setResults(response.data.results);
      setRequestId(response.data.requestId);
      saveAttempt({ projectId, key, payload, requestId: response.data.requestId });
      setPhase('result');
      if (response.status === 202) {
        setMessage('Der Veröffentlichungsstatus wird geprüft. Bitte nicht erneut veröffentlichen.');
      } else {
        setMessage('');
      }
    } catch (error) {
      if (!mountedRef.current) return;
      setPhase('result');
      setMessage(errorMessage(error));
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }

  async function refreshStatus() {
    const id = requestId || attempt?.requestId;
    if (!id) return;
    setSubmitting(true);
    try {
      const response = await getPublication(projectId, id);
      if (!mountedRef.current) return;
      setResults(response.results);
      setRequestId(response.requestId);
      const unresolved = response.results.some(result => result.status === 'pending' || result.status === 'processing');
      setMessage(unresolved ? 'Der Veröffentlichungsstatus wird geprüft. Bitte nicht erneut veröffentlichen.' : '');
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }

  function retryFailed() {
    const failed = results.filter(result => result.status === 'failed').map(result => result.provider);
    if (!failed.length) return;
    setSelectedProviders(failed);
    saveAttempt(null);
    setResults([]);
    setRequestId(null);
    setMessage('');
    setPhase('confirm');
  }

  function connectProvider(provider: Provider) {
    persistDraft(selectedProviders.includes(provider) ? selectedProviders : [...selectedProviders, provider]);
    connect(provider);
  }

  const providerRows = (['instagram', 'facebook'] as Provider[]).map(provider => ({
    provider,
    connection: connectionForProvider(connections, provider),
  }));
  const allTerminal = results.length > 0 && results.every(result => result.status === 'published' || result.status === 'failed');
  const pendingRetryAllowed = results.some(result => result.status === 'pending' && result.retryAllowed);
  const hasUnknown = results.some(result => result.status === 'processing');

  return (
    <div className="social-publish-backdrop" role="presentation">
      <section className="social-publish-sheet" role="dialog" aria-modal="true" aria-labelledby="social-publish-title">
        <header className="social-publish-header">
          <div><span className="app-kicker">Social Media</span><h2 id="social-publish-title">Veröffentlichen</h2></div>
          <button type="button" className="optional-context-close" onClick={onClose} aria-label="Schließen">×</button>
        </header>

        {phase === 'select' && (
          <>
            <p>Wähle, wo du deinen Beitrag veröffentlichen möchtest.</p>
            {unavailable && <p className="inline-notice">Social Publishing ist noch nicht aktiviert. Es wird nichts simuliert.</p>}
            <div className="social-provider-list">
              {providerRows.map(({ provider, connection }) => (
                <article className="social-provider-option" key={provider}>
                  <button type="button" className={selectedProviders.includes(provider) ? 'is-selected' : ''} onClick={() => toggleProvider(provider)} disabled={!connection?.connected}>
                    <img src={providerMeta[provider].icon} alt="" />
                    <span><strong>{providerMeta[provider].label}</strong><small>{connection?.connected ? connection.accountName : connection?.availability === 'available' ? 'Nicht verbunden' : 'In Vorbereitung'}</small></span>
                    {connection?.connected && <span aria-hidden="true">{selectedProviders.includes(provider) ? '✓' : '○'}</span>}
                  </button>
                  {connection?.availability === 'available' && !connection.connected && <button className="text-button" type="button" onClick={() => connectProvider(provider)}>Verbinden</button>}
                </article>
              ))}
              <article className="social-provider-option is-disabled"><div><img src="/visual/integrations/icons/linkedin.svg" alt="" /><span><strong>LinkedIn</strong><small>In Vorbereitung</small></span></div></article>
              <article className="social-provider-option is-disabled"><div><img src="/visual/integrations/icons/x.svg" alt="" /><span><strong>X</strong><small>In Vorbereitung</small></span></div></article>
            </div>
            <div className="social-publish-footer"><button className="button button-secondary" type="button" onClick={onClose}>Abbrechen</button><button className="button" type="button" onClick={goPreview} disabled={loading || !selectedProviders.length || !selectedMedia}>Weiter</button></div>
          </>
        )}

        {phase === 'preview' && (
          <>
            <div className="social-post-preview">
              {selectedMedia && <img src={getProjectMediaUrl(projectId, selectedMedia.id)} alt="Vorschau des zu veröffentlichenden Projektbildes" />}
              <div className="social-image-choice">
                {media?.optimized && <button type="button" className={useOptimized ? 'is-active' : ''} onClick={() => { setUseOptimized(true); persistDraft(selectedProviders, caption, true); }}>Optimiertes Bild</button>}
                {media?.original && <button type="button" className={!useOptimized ? 'is-active' : ''} onClick={() => { setUseOptimized(false); persistDraft(selectedProviders, caption, false); }}>Originalbild</button>}
              </div>
              <div className="social-preview-accounts">
                {selectedProviders.map(provider => {
                  const connection = connectionForProvider(connections, provider);
                  return <span key={provider}><img src={providerMeta[provider].icon} alt="" />{providerMeta[provider].label}: <strong>{connection?.accountName}</strong></span>;
                })}
              </div>
              <label className="social-caption-editor">Beitragstext<textarea value={caption} onChange={event => { setCaption(event.target.value); persistDraft(selectedProviders, event.target.value); }} rows={7} /></label>
              <small>{captionLength} / {captionLimit} Zeichen</small>
              {instagramMimeBlocked && <p className="auth-error">Instagram unterstützt in diesem Flow nur JPEG-Bilder. Wähle eine unterstützte Bildversion.</p>}
              {captionLength > captionLimit && <p className="auth-error">Der Text ist für die gewählten Kanäle zu lang.</p>}
            </div>
            <div className="social-publish-footer"><button className="button button-secondary" type="button" onClick={() => setPhase('select')}>Zurück</button><button className="button" type="button" onClick={() => setPhase('confirm')} disabled={!caption.trim() || captionLength > captionLimit || instagramMimeBlocked}>Beitrag prüfen</button></div>
          </>
        )}

        {phase === 'confirm' && (
          <>
            <div className="social-confirmation">
              <span className="processing-orb"><AppIcon name="share" /></span>
              <h3>Beitrag veröffentlichen?</h3>
              <p>Der Beitrag wird erst nach deiner Bestätigung an {selectedProviders.map(provider => providerMeta[provider].label).join(' und ')} gesendet.</p>
              <strong>{projectTitle || 'DFBK.app Projekt'}</strong>
            </div>
            <div className="social-publish-footer"><button className="button button-secondary" type="button" onClick={() => setPhase('preview')} disabled={submitting}>Abbrechen</button><button className="button" type="button" onClick={() => void submitExact(false)} disabled={submitting}>{submitting ? 'Wird veröffentlicht …' : 'Jetzt veröffentlichen'}</button></div>
          </>
        )}

        {phase === 'result' && (
          <>
            {message && <p className="inline-notice" role="status">{message}</p>}
            <div className="social-publication-results">
              {results.map(result => {
                const externalUrl = safeProviderUrl(result.provider, result.url);
                return (
                  <article key={result.jobId} className={`social-publication-result is-${result.status}`}>
                    <img src={providerMeta[result.provider].icon} alt="" />
                    <div>
                      <strong>{providerMeta[result.provider].label}</strong>
                      <span>{result.status === 'published' ? 'Veröffentlicht' : result.status === 'failed' ? 'Fehler' : result.status === 'processing' ? 'Status wird geprüft' : 'Wird verarbeitet'}</span>
                    </div>
                    {result.status === 'published' && <AppIcon name="check" />}
                    {externalUrl && <a href={externalUrl} target="_blank" rel="noopener noreferrer">Beitrag öffnen</a>}
                  </article>
                );
              })}
            </div>

            <div className="social-publish-footer">
              <button className="button button-secondary" type="button" onClick={onClose}>Schließen</button>
              {!allTerminal && (requestId || attempt?.requestId) && <button className="button button-secondary" type="button" disabled={submitting} onClick={() => void refreshStatus()}>Status aktualisieren</button>}
              {pendingRetryAllowed && !hasUnknown && <button className="button" type="button" disabled={submitting} onClick={() => void submitExact(true)}>Sicher weiter prüfen</button>}
              {results.some(result => result.status === 'failed') && allTerminal && <button className="button" type="button" onClick={retryFailed}>Fehlgeschlagene erneut veröffentlichen</button>}
              {!results.length && attempt?.projectId === projectId && <button className="button" type="button" disabled={submitting} onClick={() => void submitExact(true)}>Mit gleichem Versuch fortsetzen</button>}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
