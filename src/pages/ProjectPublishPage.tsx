import { useEffect, useMemo, useRef, useState } from 'react';
import { useUserArea, type AppProject, type ProjectContent } from '../contexts/UserAreaContext';
import { useSocialPublishing, connectionForProvider } from '../contexts/SocialPublishingContext';
import { getProjectMediaUrl } from '../services/projects';
import PublishingPanel from '../components/PublishingPanel';
import { type PublishingChannel } from '../config/publishing';
import { navigate } from '../lib/router';
import '../styles/integrations-share.css';
import AppLink from '../components/AppLink';
import { useAuth } from '../contexts/AuthContext';
import type { ProjectMediaResponse } from '../types/models';
export default function ProjectPublishPage({ id }: { id: string }) {
  const { getProject, getProjectMedia, getProjectContent, plan, planLoading, reloadPlan } = useUserArea();
  const { connections, publish, getPublication, attempt, saveAttempt, draft } = useSocialPublishing();
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<{ ownerId: string; project: AppProject; content: ProjectContent | null; media: ProjectMediaResponse } | null>(null);
  const [revision, setRevision] = useState(0);
  const [useOriginal, setUseOriginal] = useState(false);
  // Hide the previous project's/account's snapshot before the next effect runs.
  const current = snapshot?.project.id === id && snapshot.ownerId === user?.id ? snapshot : null;
  const project = current?.project;
  const content = current?.content;
  const media = current?.media;
  const optimized = Boolean(media?.media.optimized && !useOriginal);
  const mediaId = (optimized ? media?.media.optimized : media?.media.original)?.id || '';
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const inFlight = useRef(false);
  const [checking, setChecking] = useState(false);
  const [terminalRequest, setTerminalRequest] = useState<string | null>(null);
  const [continuableRequest, setContinuableRequest] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setSnapshot(null); setUseOriginal(false); setError(''); setResult('');
    setTerminalRequest(null); setContinuableRequest(null);
    if (!user) return;
    const ownerId = user.id;
    void Promise.all([getProject(id), getProjectMedia(id), getProjectContent(id)]).then(([project, media, content]) => {
      if (active && project.id === id) setSnapshot({ ownerId, project, media, content });
    }).catch(() => { if (active) setError('Projekt konnte nicht geladen werden oder ist nicht zugänglich.'); });
    return () => { active = false; };
  }, [id, user?.id, revision, getProject, getProjectMedia, getProjectContent]);
  const texts = useMemo(() => {
    if (!content || !project) return null;
    // Existing KI results are starting points, never claim a new paid AI generation.
    return {
      instagram: draft?.projectId === id ? draft.caption : content.social, facebook: content.google,
      pinterest: project.title + '\n\n' + content.website,
      whatsapp: content.social, x: content.social, linkedin: content.website,
      email: content.website, google_business: content.google, website: content.website,
    } as Record<PublishingChannel, string>;
  }, [content, project, draft, id]);
  async function send(channel: 'instagram' | 'facebook', caption: string) {
    if (inFlight.current) return 'Ein Vorgang läuft bereits.';
    if (attempt) return 'Ein gespeicherter Versuch liegt vor. Prüfe zuerst seinen Status oder setze exakt denselben Versuch fort.';
    if (!connectionForProvider(connections, channel)?.connected) {
      return 'Bitte verbinde zuerst dein Konto unter Integrationen. Es wurde nichts veröffentlicht.';
    }
    inFlight.current = true;
    setTerminalRequest(null); setContinuableRequest(null);
    const key = crypto.randomUUID();
    const payload = { providers: [channel], caption, mediaId, useOptimizedImage: optimized } as const;
    const mutable = { ...payload, providers: [channel] };
    try {
      saveAttempt({ projectId: id, key, payload: mutable, requestId: null });
    } catch { inFlight.current = false; return 'Der Browser kann den Versuch nicht sicher speichern. Es wurde nichts gesendet.'; }
    try {
      const response = await publish(id, mutable, key);
      saveAttempt({ projectId: id, key, payload: mutable, requestId: response.data.requestId });
      if (response.data.results.length > 0 && response.data.results.every(item => item.status === 'published' || item.status === 'failed')) setTerminalRequest(response.data.requestId);
      if (response.data.results.some(item => item.status === 'pending' && item.retryAllowed)) setContinuableRequest(response.data.requestId);
      const status = response.data.results.map(item => item.provider + ': ' + item.status).join(' · ');
      setResult(status); return status;
    } catch {
      return 'Ergebnis unklar. Der ursprüngliche Versuch bleibt gespeichert. Nicht neu veröffentlichen.';
    } finally { inFlight.current = false; }
  }
  async function recover(continuePending = false) {
    if (attempt?.projectId !== id || inFlight.current) return;
    if (continuePending && continuableRequest !== attempt.requestId) return;
    inFlight.current = true; setChecking(true); setTerminalRequest(null); setContinuableRequest(null);
    try {
      const response = attempt.requestId && !continuePending ? await getPublication(id, attempt.requestId) : (await publish(id, attempt.payload, attempt.key)).data;
      saveAttempt({ ...attempt, requestId: response.requestId });
      if (response.results.length > 0 && response.results.every(item => item.status === 'published' || item.status === 'failed')) setTerminalRequest(response.requestId);
      if (response.results.some(item => item.status === 'pending' && item.retryAllowed)) setContinuableRequest(response.requestId);
      setResult(response.results.map(item => item.provider + ': ' + item.status).join(' · '));
    } catch { setResult('Status noch unklar. Versuch nicht zurücksetzen.'); }
    finally { inFlight.current = false; setChecking(false); }
  }
  if (planLoading) return <div className="app-page">Zugang wird geprüft …</div>;
  if (plan.source !== 'backend' || plan.status !== 'active' || !plan.features.share) return <div className="app-page"><h1>Veröffentlichung vorbereiten</h1><p>Zugang konnte nicht bestätigt werden. Bitte lade deinen Tarifstatus erneut.</p><button type="button" onClick={() => void reloadPlan()}>Status erneut laden</button></div>;
  if (error) return <div className="app-page"><h1>Projekt nicht verfügbar</h1><p role="alert">{error}</p><button className="button" type="button" onClick={() => setRevision(value => value + 1)}>Erneut laden</button><AppLink className="back-link" to="/app/projects">Zu meinen Projekten</AppLink></div>;
  if (!project || !media) return <div className="app-page" role="status">Projekt wird geladen …</div>;
  const ready = ['ready', 'finished'].includes(project.status) && Boolean(texts && Object.values(texts).every(text => text.trim()));
  const processing = project.status === 'processing' || media.photoOptimization.state === 'processing';
  const canPrepare = ready && !processing && Boolean(mediaId) && (optimized || useOriginal);
  return <div className="app-page project-result">
    <AppLink className="back-link" to={'/app/projects/' + encodeURIComponent(id)}>← Projektdetails</AppLink>
    <header className="app-page-heading"><h1>{project.title}</h1><p>Wähle, wo du dein Ergebnis verwenden möchtest. Prüfe dafür dein Bild und den passenden Ausgangstext.</p></header>
    <section className="project-result__images" aria-label="Bildversionen dieses Projekts">
      {media.media.original && <figure><img src={getProjectMediaUrl(id, media.media.original.id)} alt="Hochgeladenes Original dieses Projekts" /><figcaption>Dein hochgeladenes Foto</figcaption></figure>}
      {media.media.optimized && <figure><img src={getProjectMediaUrl(id, media.media.optimized.id)} alt="Optimierte Version dieses Projekts" /><figcaption>Optimiertes Foto{optimized && canPrepare ? ' · für den Beitrag ausgewählt' : ''}</figcaption></figure>}
    </section>
    {!canPrepare && <section className="inline-notice" aria-label="Materialstatus">
      <h2>{processing ? 'Dein Projekt wird noch verarbeitet' : project.status === 'failed' ? 'Die Verarbeitung wurde nicht abgeschlossen' : !ready ? 'Deine Texte sind noch nicht vollständig verfügbar' : !media.media.original && !media.media.optimized ? 'Das Projektbild ist nicht verfügbar' : 'Das optimierte Foto ist noch nicht verfügbar'}</h2>
      <p>{processing ? 'Lade den Status erneut, sobald die Verarbeitung abgeschlossen ist.' : 'Prüfe dein Projekt oder lade die gespeicherten Materialien erneut.'} Hier wird keine neue Erstellung gestartet.</p>
      <div className="publishing-actions">
        <button className="button button-secondary" type="button" onClick={() => setRevision(value => value + 1)}>Materialstatus erneut laden</button>
        {ready && !processing && !media.media.optimized && media.media.original && <button className="button" type="button" onClick={() => setUseOriginal(true)}>Mit dem Originalfoto fortfahren</button>}
        <AppLink className="button button-secondary" to={'/app/projects/' + encodeURIComponent(id)}>Projekt prüfen</AppLink>
      </div>
    </section>}
    {canPrepare && !optimized && <p className="inline-notice" role="status">Du verwendest ausdrücklich dein Originalfoto. Es wurde kein optimiertes Foto ausgewählt.</p>}
    {attempt?.projectId === id && <section className="inline-notice"><p>Gespeicherter Veröffentlichungsversuch: erst klären, dann einen neuen Beitrag vorbereiten.</p><button type="button" disabled={checking} onClick={() => void recover()}>Gespeicherten Versuch prüfen</button>{continuableRequest && continuableRequest === attempt.requestId && <button type="button" disabled={checking} onClick={() => void recover(true)}>Denselben ausstehenden Versuch fortsetzen</button>}{terminalRequest === attempt.requestId && terminalRequest && <button type="button" disabled={checking} onClick={() => { if (window.confirm('Dieser Versuch ist abgeschlossen. Einen weiteren Beitrag vorbereiten?')) { saveAttempt(null); setTerminalRequest(null); setResult(''); } }}>Weiteren Beitrag vorbereiten</button>}<p role="status">{result}</p></section>}
    {attempt && attempt.projectId !== id && <p role="alert">Ein ungeklärter Veröffentlichungsversuch eines anderen Projekts ist gespeichert. Öffne zuerst dieses Projekt und prüfe seinen Status.</p>}
    {canPrepare && texts && <PublishingPanel key={id + ':' + mediaId} title={project.title} imageUrl={getProjectMediaUrl(id, mediaId)} texts={texts} onDirectPublish={send} />}
    <p className="project-result__help">Die Texte stammen aus deinen vorhandenen KI-Ergebnissen und lassen sich pro Kanal bearbeiten. Download, Kopieren oder Teilen bestätigt noch keine Veröffentlichung.</p>
    <button className="button button-secondary" type="button" onClick={() => navigate('/app/integrations')}>Verbundene Konten verwalten</button>
  </div>;
}
