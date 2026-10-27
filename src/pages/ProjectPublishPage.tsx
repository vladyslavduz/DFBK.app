import { useEffect, useMemo, useRef, useState } from 'react';
import { useUserArea, type AppProject, type ProjectContent } from '../contexts/UserAreaContext';
import { useSocialPublishing, connectionForProvider } from '../contexts/SocialPublishingContext';
import { getProjectMediaUrl } from '../services/projects';
import PublishingPanel from '../components/PublishingPanel';
import { type PublishingChannel } from '../config/publishing';
import { navigate } from '../lib/router';
import '../styles/integrations-share.css';
export default function ProjectPublishPage({ id }: { id: string }) {
  const { getProject, getProjectMedia, getProjectContent, plan, planLoading, reloadPlan } = useUserArea();
  const { connections, publish, getPublication, attempt, saveAttempt, draft } = useSocialPublishing();
  const [project, setProject] = useState<AppProject | null>(null);
  const [content, setContent] = useState<ProjectContent | null>(null);
  const [mediaId, setMediaId] = useState('');
  const [optimized, setOptimized] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const inFlight = useRef(false);
  const [checking, setChecking] = useState(false);
  const [terminalRequest, setTerminalRequest] = useState<string | null>(null);
  const [continuableRequest, setContinuableRequest] = useState<string | null>(null);
  useEffect(() => {
    let active = true; setProject(null); setContent(null); setMediaId(''); setError('');
    void Promise.all([getProject(id), getProjectMedia(id), getProjectContent(id)]).then(([p, m, c]) => {
      if (!active) return;
      const selected = m.media.optimized || m.media.original;
      if (!selected || !c) { setError('Für dieses Projekt fehlen Bild oder fertige Inhalte.'); return; }
      setProject(p); setContent(c); setMediaId(selected.id); setOptimized(Boolean(m.media.optimized));
    }).catch(() => { if (active) setError('Projekt konnte nicht geladen werden oder ist nicht zugänglich.'); });
    return () => { active = false; };
  }, [id, getProject, getProjectMedia, getProjectContent]);
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
  if (error) return <div className="app-page"><h1>Veröffentlichung vorbereiten</h1><p role="alert">{error}</p></div>;
  if (!project || !texts) return <div className="app-page">Projekt wird geladen …</div>;
  return <div className="app-page"><header className="app-page-heading"><h1>{project.title}</h1><p>Nur Materialien dieses Projekts. Prüfe die kanalbezogenen Ausgangstexte aus deinen vorhandenen KI-Ergebnissen vor der Veröffentlichung.</p></header>
    <button className="button button-secondary" type="button" onClick={() => navigate('/app/integrations')}>Konten verbinden</button>
    {attempt?.projectId === id && <section className="inline-notice"><p>Gespeicherter Veröffentlichungsversuch: erst klären, dann einen neuen Beitrag vorbereiten.</p><button type="button" disabled={checking} onClick={() => void recover()}>Gespeicherten Versuch prüfen</button>{continuableRequest && continuableRequest === attempt.requestId && <button type="button" disabled={checking} onClick={() => void recover(true)}>Denselben ausstehenden Versuch fortsetzen</button>}{terminalRequest === attempt.requestId && terminalRequest && <button type="button" disabled={checking} onClick={() => { if (window.confirm('Dieser Versuch ist abgeschlossen. Einen weiteren Beitrag vorbereiten?')) { saveAttempt(null); setTerminalRequest(null); setResult(''); } }}>Weiteren Beitrag vorbereiten</button>}<p role="status">{result}</p></section>}
    {attempt && attempt.projectId !== id && <p role="alert">Ein ungeklärter Veröffentlichungsversuch eines anderen Projekts ist gespeichert. Öffne zuerst dieses Projekt und prüfe seinen Status.</p>}
    <PublishingPanel key={id} title={project.title} imageUrl={getProjectMediaUrl(id, mediaId)} texts={texts} onDirectPublish={send} />
  </div>;
}
