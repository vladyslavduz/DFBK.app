import { useCallback, useEffect, useRef, useState } from 'react';
import AppIcon from '../components/AppIcon';
import AppLink from '../components/AppLink';
import ChannelCard from '../components/ChannelCard';
import DescriptionInput from '../components/DescriptionInput';
import PhotoUploader from '../components/PhotoUploader';
import ProcessingState from '../components/ProcessingState';
import ProjectImageViewer from '../components/ProjectImageViewer';
import { projectStatusLabel, useUserArea, type AppProject } from '../contexts/UserAreaContext';
import { ApiError } from '../lib/api';
import { projectGenerationErrorMessage } from '../lib/project-generation';
import { getProjectMediaUrl } from '../services/projects';

type Step = 1 | 2 | 3 | 4;

function projectFlowError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 413 || error.code === 'IMAGE_TOO_LARGE') return 'Das Bild ist zu groß. Maximal 10 MB.';
    if (error.code === 'UNSUPPORTED_IMAGE_TYPE') return 'JPG, PNG oder WebP verwenden';
    if (error.code === 'INVALID_IMAGE_SIGNATURE') return 'Ungültige Bilddatei';
  }
  return projectGenerationErrorMessage(error);
}

export default function CreateProjectPage() {
  const { createProject, generateProjectContent, getProject, getProjectContent, getProjectMedia, uploadProjectMedia, updateContent } = useUserArea();
  const [step, setStep] = useState<Step>(1);
  const [image, setImage] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [project, setProject] = useState<AppProject | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [mediaLoadError, setMediaLoadError] = useState('');
  const [trialLimitReached, setTrialLimitReached] = useState(false);
  const submittingRef = useRef(false);
  const createdProjectRef = useRef<AppProject | null>(null);
  const mediaUploadedRef = useRef(false);
  const generationAttemptedRef = useRef(false);
  const generationCompletedRef = useRef(false);

  useEffect(() => () => { if (image.startsWith('blob:')) URL.revokeObjectURL(image); }, [image]);

  function selectPhoto(file: File) {
    setPhotoFile(file);
    setImage(URL.createObjectURL(file));
    mediaUploadedRef.current = false;
    setSubmitError('');
    setMediaLoadError('');
  }

  const finishProcessing = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError('');
    setMediaLoadError('');
    setStep(3);

    try {
      let createdProject = createdProjectRef.current;
      if (!createdProject) {
        createdProject = await createProject({ description });
        createdProjectRef.current = createdProject;
      }

      if (!photoFile) throw new ApiError(400, 'PROJECT_IMAGE_REQUIRED');
      if (!mediaUploadedRef.current) {
        let uploadedOriginal = '';
        try {
          const uploaded = await uploadProjectMedia(createdProject.id, photoFile);
          uploadedOriginal = getProjectMediaUrl(uploaded.projectId, uploaded.id);
          createdProject = {
            ...createdProject,
            media: { original: { id: uploaded.id, mimeType: uploaded.mimeType }, optimized: null },
            originalImage: uploadedOriginal,
            optimizedImage: null,
          };
        } catch (uploadError) {
          if (!(uploadError instanceof ApiError) || uploadError.status !== 409 || !['PHOTO_OPTIMIZATION_IN_PROGRESS', 'PHOTO_ALREADY_OPTIMIZED'].includes(uploadError.code)) {
            throw uploadError;
          }
        }

        try {
          const mediaState = await getProjectMedia(createdProject.id);
          if (!mediaState.media.original) throw new ApiError(500, 'PROJECT_IMAGE_UNAVAILABLE');
          createdProject = {
            ...createdProject,
            media: mediaState.media,
            photoOptimization: mediaState.photoOptimization,
            originalImage: getProjectMediaUrl(createdProject.id, mediaState.media.original.id),
            optimizedImage: mediaState.media.optimized ? getProjectMediaUrl(createdProject.id, mediaState.media.optimized.id) : null,
          };
        } catch (mediaError) {
          if (!uploadedOriginal) throw mediaError;
          setMediaLoadError('Die Bildversionen konnten noch nicht vollständig geladen werden. Das Original bleibt verfügbar.');
        }

        createdProjectRef.current = createdProject;
        mediaUploadedRef.current = true;
      }

      if (generationAttemptedRef.current && !generationCompletedRef.current) {
        const savedProject = await getProject(createdProject.id);
        if (savedProject.status === 'ready') generationCompletedRef.current = true;
        else if (savedProject.status === 'processing') throw new ApiError(409, 'GENERATION_ALREADY_RUNNING');
        else generationAttemptedRef.current = false;
      }

      if (!generationCompletedRef.current) {
        generationAttemptedRef.current = true;
        const generated = await generateProjectContent(createdProject.id);
        createdProject = generated.project;
        createdProjectRef.current = createdProject;
        generationCompletedRef.current = true;
      }

      const content = createdProject.content || await getProjectContent(createdProject.id);
      if (!content) throw new ApiError(500, 'PROJECT_CONTENT_UNAVAILABLE');

      setProject({ ...createdProject, content });
      setStep(4);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'TRIAL_PROJECT_LIMIT_REACHED') {
        setTrialLimitReached(true);
        setSubmitError('');
      } else {
        setSubmitError(projectFlowError(error));
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [createProject, description, generateProjectContent, getProject, getProjectContent, getProjectMedia, photoFile, uploadProjectMedia]);

  if (trialLimitReached) {
    return (
      <div className="app-page app-wizard-page">
        <section className="trial-limit-card">
          <span className="app-kicker">Testphase</span>
          <h1>Deine Testphase ist vollständig genutzt.</h1>
          <p>Du hast DFBK.app mit 5 eigenen Projekten ausprobiert.</p>
          <div className="trial-limit-actions">
            <AppLink className="button" to="/app/billing">Mit Business weitermachen</AppLink>
            <AppLink className="button button-secondary" to="/app/projects">Meine Projekte</AppLink>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="app-page app-wizard-page">
      <nav className="wizard-progress" aria-label="Projektfortschritt">{['Foto', 'Zusatzinfo', 'DFBK.app', 'Ergebnis'].map((label, index) => { const number = index + 1; return <span className={number === step ? 'is-active' : number < step ? 'is-done' : ''} key={label}><i>{number < step ? <AppIcon name="check" /> : number}</i><b>{label}</b></span>; })}</nav>
      {step === 1 && <PhotoUploader preview={image} onSelect={selectPhoto} onContinue={() => { if (createdProjectRef.current) void finishProcessing(); else setStep(2); }} />}
      {step === 2 && <DescriptionInput value={description} onChange={setDescription} onBack={() => setStep(1)} onContinue={finishProcessing} />}
      {step === 3 && <ProcessingState includesPhotoOptimization error={submitError} retrying={submitting} onRetry={finishProcessing} onChangePhoto={createdProjectRef.current && createdProjectRef.current.photoOptimization.state !== 'available' ? undefined : () => { setSubmitError(''); setStep(1); }} />}
      {step === 4 && project?.content && (
        <section className="wizard-result">
          <header className="wizard-heading center"><span className="result-check"><AppIcon name="check" /></span><span className="app-kicker">Schritt 4</span><h1>Dein Content ist fertig</h1><p>Du kannst die Texte direkt verwenden oder noch bearbeiten.</p></header>

          <ProjectImageViewer
            projectId={project.id}
            originalImage={project.originalImage}
            optimizedImage={project.optimizedImage}
            mediaLoadError={mediaLoadError}
            photoOptimizationState={project.photoOptimization.state}
            onImagesChange={(originalImage, optimizedImage) => setProject(current => current ? { ...current, originalImage, optimizedImage } : current)}
            onOptimizationStateChange={state => setProject(current => current ? { ...current, photoOptimization: { state } } : current)}
          />

          <div className="result-photo-summary"><div><span className={`project-status status-${project.status}`}><AppIcon name="check" />{projectStatusLabel(project.status)}</span><h2>{project.title}</h2>{project.description && <p>{project.description}</p>}</div></div>
          <div className="channel-list">{(['google', 'social', 'website'] as const).map(channel => <ChannelCard channel={channel} value={project.content?.[channel] || ''} onChange={value => updateContent(project.id, channel, value)} projectId={project.id} projectTitle={project.title} downloadImage={project.optimizedImage || project.originalImage} key={channel} />)}</div>
          <div className="visibility-panel"><div><span className="app-kicker">Sichtbar werden</span><h2>Bereit für deine Kanäle</h2><p>Text kopieren und die gewünschte Bildversion dort einsetzen, wo deine Kunden dich finden.</p></div><div className="channel-pills"><span>Google</span><span>Website</span><span>Instagram</span><span>Facebook</span></div></div>
          <div className="wizard-result-actions"><AppLink className="button" to={`/app/projects/${project.id}`}>Projekt öffnen<AppIcon name="arrow" /></AppLink><AppLink className="button button-secondary" to="/app">Zur Übersicht</AppLink></div>
        </section>
      )}
    </div>
  );
}
