import { useCallback, useEffect, useRef, useState } from 'react';
import AppIcon from '../components/AppIcon';
import AppLink from '../components/AppLink';
import ChannelCard from '../components/ChannelCard';
import ProcessingState from '../components/ProcessingState';
import ProjectImageViewer from '../components/ProjectImageViewer';
import ProjectRename from '../components/ProjectRename';
import {
  projectStatusLabel,
  useUserArea,
  type AppProject,
  type ContentChannel,
} from '../contexts/UserAreaContext';
import { ApiError } from '../lib/api';
import { formatProjectDate } from '../lib/project-date';
import { projectGenerationErrorMessage } from '../lib/project-generation';
import { getProjectMediaUrl } from '../services/projects';
import type { ProjectMediaResponse } from '../types/models';

function withMedia(project: AppProject, state: ProjectMediaResponse): AppProject {
  return {
    ...project,
    media: state.media,
    photoOptimization: state.photoOptimization,
    originalImage: state.media.original ? getProjectMediaUrl(project.id, state.media.original.id) : null,
    optimizedImage: state.media.optimized ? getProjectMediaUrl(project.id, state.media.optimized.id) : null,
  };
}

export default function ProjectDetailPage({ id }: { id: string }) {
  const { generateProjectContent, getProject, getProjectContent, getProjectMedia, updateContent } = useUserArea();
  const [project, setProject] = useState<AppProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<'not-found' | 'generic' | null>(null);
  const [generationError, setGenerationError] = useState('');
  const [mediaLoadError, setMediaLoadError] = useState('');
  const generatingRef = useRef(false);

  const loadProject = useCallback(async () => {
    setLoading(true);
    setError(null);
    setGenerationError('');
    setMediaLoadError('');
    try {
      const loadedProject = await getProject(id);
      const content = await getProjectContent(id);
      let hydratedProject = { ...loadedProject, content };
      try {
        const mediaState = await getProjectMedia(id);
        hydratedProject = withMedia(hydratedProject, mediaState);
      } catch {
        setMediaLoadError('Die Bildversionen konnten nicht vollständig geladen werden. Das verfügbare Original bleibt nutzbar.');
      }
      setProject(hydratedProject);
    } catch (requestError) {
      setProject(null);
      setError(requestError instanceof ApiError && requestError.code === 'PROJECT_NOT_FOUND' ? 'not-found' : 'generic');
    } finally {
      setLoading(false);
    }
  }, [getProject, getProjectContent, getProjectMedia, id]);

  useEffect(() => { void loadProject(); }, [loadProject]);

  const generate = useCallback(async () => {
    if (generatingRef.current || !project) return;
    generatingRef.current = true;
    setGenerating(true);
    setGenerationError('');
    setProject(current => current ? { ...current, status: 'processing' } : current);

    try {
      const generated = await generateProjectContent(project.id);
      setProject(generated.project);
    } catch (requestError) {
      setGenerationError(projectGenerationErrorMessage(requestError));
      try {
        const savedProject = await getProject(project.id);
        setProject({ ...savedProject, media: project.media, originalImage: project.originalImage, optimizedImage: project.optimizedImage, content: project.content });
      } catch {
        setProject(current => current ? { ...current, status: 'processing' } : current);
      }
    } finally {
      generatingRef.current = false;
      setGenerating(false);
    }
  }, [generateProjectContent, getProject, project]);

  function changeContent(channel: ContentChannel, value: string) {
    if (!project?.content) return;
    updateContent(project.id, channel, value);
    setProject(current => current?.content ? { ...current, content: { ...current.content, [channel]: value } } : current);
  }

  if (loading) return <div className="app-page"><div className="app-empty-card" aria-live="polite"><span className="processing-orb"><AppIcon name="spark" /></span><h1>Projekt wird geladen</h1></div></div>;
  if (error === 'generic') return <div className="app-page"><div className="app-empty-card"><AppIcon name="folder" /><h1>Projekt konnte nicht geladen werden</h1><p>Etwas ist schiefgelaufen. Bitte versuche es erneut.</p><button className="button" type="button" onClick={() => void loadProject()}>Erneut laden</button></div></div>;
  if (error === 'not-found' || !project) return <div className="app-page"><div className="app-empty-card"><AppIcon name="folder" /><h1>Projekt nicht gefunden</h1><p>Dieses Projekt ist nicht verfügbar.</p><AppLink className="button" to="/app/projects">Zu meinen Projekten</AppLink></div></div>;

  const hasContent = Boolean(project.content);
  const showContent = hasContent && ['ready', 'finished'].includes(project.status);

  return (
    <div className="app-page">
      <AppLink className="back-link" to="/app/projects">← Meine Projekte</AppLink>
      <header className="app-page-heading project-detail-heading">
        <div>
          <span className={`project-status status-${project.status}`}>{projectStatusLabel(project.status)}</span>
          <div className="project-detail-title-row">
            <h1>{project.title}</h1>
            <ProjectRename projectId={project.id} title={project.title} onRenamed={title => setProject(current => current ? { ...current, title, titleSource: 'manual' } : current)} compact />
          </div>
          <p>{formatProjectDate(project.createdAt, true)}</p>
        </div>
      </header>

      <ProjectImageViewer
        projectId={project.id}
        originalImage={project.originalImage}
        optimizedImage={project.optimizedImage}
        photoOptimizationState={project.photoOptimization.state}
        mediaLoadError={mediaLoadError}
        onImagesChange={(originalImage, optimizedImage) => setProject(current => current ? { ...current, originalImage, optimizedImage } : current)}
        onOptimizationStateChange={state => setProject(current => current ? { ...current, photoOptimization: { state } } : current)}
      />

      {project.description && <section className="project-description"><span className="app-kicker">Zusatzinfo</span><h2>Zu dieser Arbeit</h2><p>{project.description}</p></section>}

      {project.status === 'processing' && <ProcessingState error={generationError} retrying={generating} onReload={() => void loadProject()} />}

      {project.status === 'failed' && (
        <section className="generation-action-card" role="alert">
          <span className="processing-orb"><AppIcon name="spark" /></span>
          <h2>Die Inhalte konnten nicht erstellt werden</h2>
          <p>{generationError || 'Bitte versuche die Erstellung noch einmal.'}</p>
          <button className="button" type="button" disabled={generating} onClick={() => void generate()}>{generating ? 'DFBK.app erstellt deine Inhalte …' : 'Erneut erstellen'}</button>
        </section>
      )}

      {project.status === 'draft' && (
        <section className="generation-action-card">
          <span className="processing-orb"><AppIcon name="spark" /></span>
          <h2>Content für dieses Projekt erstellen</h2>
          <p>DFBK.app erstellt passende Texte aus deinem Foto und berücksichtigt deine Zusatzinfo, falls vorhanden.</p>
          {generationError && <p className="generation-error" role="alert">{generationError}</p>}
          <button className="button" type="button" disabled={generating} onClick={() => void generate()}>{generating ? 'DFBK.app erstellt deine Inhalte …' : 'Content erstellen'}</button>
        </section>
      )}

      {project.status === 'ready' && !hasContent && (
        <section className="generation-action-card" role="alert">
          <h2>Gespeicherte Inhalte konnten nicht geladen werden</h2>
          <p>Bitte lade das Projekt noch einmal.</p>
          <button className="button" type="button" onClick={() => void loadProject()}>Erneut laden</button>
        </section>
      )}

      {showContent && project.content && (
        <>
          <section><div className="section-title-row"><div><span className="app-kicker">Erstellte Inhalte</span><h2>Fertig für deine Kunden</h2></div></div><div className="channel-list">{(['google', 'social', 'website'] as const).map(channel => <ChannelCard channel={channel} value={project.content?.[channel] || ''} onChange={value => changeContent(channel, value)} projectId={project.id} projectTitle={project.title} downloadImage={project.optimizedImage || project.originalImage} key={channel} />)}</div></section>
          <section className="visibility-panel"><div><span className="app-kicker">Sichtbar werden</span><h2>Content verwenden</h2><p>Kopiere deine Texte und lade die gewünschte Bildversion für Website, Google oder Social Media herunter.</p></div><div className="channel-pills"><span>Google</span><span>Website</span><span>Instagram</span><span>Facebook</span></div></section>
        </>
      )}
    </div>
  );
}
