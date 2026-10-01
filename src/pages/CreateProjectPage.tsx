import { useCallback, useEffect, useRef, useState } from 'react';
import AppIcon from '../components/AppIcon';
import AppLink from '../components/AppLink';
import ChannelCard from '../components/ChannelCard';
import DescriptionInput from '../components/DescriptionInput';
import PhotoUploader from '../components/PhotoUploader';
import ProcessingState from '../components/ProcessingState';
import { projectStatusLabel, useUserArea, type AppProject } from '../contexts/UserAreaContext';
import { ApiError } from '../lib/api';
import { projectGenerationErrorMessage } from '../lib/project-generation';

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
  const { createProject, generateProjectContent, getProject, getProjectContent, uploadProjectMedia, updateContent } = useUserArea();
  const [step, setStep] = useState<Step>(1);
  const [image, setImage] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [project, setProject] = useState<AppProject | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
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
  }

  const finishProcessing = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError('');
    setStep(3);

    try {
      let createdProject = createdProjectRef.current;
      if (!createdProject) {
        createdProject = await createProject({ description });
        createdProjectRef.current = createdProject;
      }

      if (!photoFile) throw new ApiError(400, 'PROJECT_IMAGE_REQUIRED');
      if (!mediaUploadedRef.current) {
        const media = await uploadProjectMedia(createdProject.id, photoFile);
        const imageUrl = `/api/projects/${encodeURIComponent(media.projectId)}/media/${encodeURIComponent(media.id)}`;
        createdProject = { ...createdProject, originalImage: imageUrl, optimizedImage: imageUrl };
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
        await generateProjectContent(createdProject.id);
        generationCompletedRef.current = true;
      }

      const content = await getProjectContent(createdProject.id);
      if (!content) throw new ApiError(500, 'PROJECT_CONTENT_UNAVAILABLE');

      setProject({ ...createdProject, status: 'ready', content });
      setStep(4);
    } catch (error) {
      setSubmitError(projectFlowError(error));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [createProject, description, generateProjectContent, getProject, getProjectContent, photoFile, uploadProjectMedia]);

  return (
    <div className="app-page app-wizard-page">
      <nav className="wizard-progress" aria-label="Projektfortschritt">{['Foto', 'Zusatzinfo', 'DFBK.app', 'Ergebnis'].map((label, index) => { const number = index + 1; return <span className={number === step ? 'is-active' : number < step ? 'is-done' : ''} key={label}><i>{number < step ? <AppIcon name="check" /> : number}</i><b>{label}</b></span>; })}</nav>
      {step === 1 && <PhotoUploader preview={image} onSelect={selectPhoto} onContinue={() => { if (createdProjectRef.current) void finishProcessing(); else setStep(2); }} />}
      {step === 2 && <DescriptionInput value={description} onChange={setDescription} onBack={() => setStep(1)} onContinue={finishProcessing} />}
      {step === 3 && <ProcessingState error={submitError} retrying={submitting} onRetry={finishProcessing} onChangePhoto={() => { setSubmitError(''); setStep(1); }} />}
      {step === 4 && project?.content && (
        <section className="wizard-result">
          <header className="wizard-heading center"><span className="result-check"><AppIcon name="check" /></span><span className="app-kicker">Schritt 4</span><h1>Dein Content ist fertig</h1><p>Du kannst die Texte direkt verwenden oder noch bearbeiten.</p></header>
          <div className="result-photo-summary"><img src={project.optimizedImage} alt="Fertiges Projekt" /><div><span className={`project-status status-${project.status}`}><AppIcon name="check" />{projectStatusLabel(project.status)}</span><h2>{project.title}</h2>{project.description && <p>{project.description}</p>}<a className="button button-secondary" href={project.optimizedImage} download="dfbk-projektbild"><AppIcon name="download" />Bild herunterladen</a></div></div>
          <div className="channel-list">{(['google', 'social', 'website'] as const).map(channel => <ChannelCard channel={channel} value={project.content?.[channel] || ''} onChange={value => updateContent(project.id, channel, value)} key={channel} />)}</div>
          <div className="visibility-panel"><div><span className="app-kicker">Sichtbar werden</span><h2>Bereit für deine Kanäle</h2><p>Text kopieren, Bild herunterladen und dort einsetzen, wo deine Kunden dich finden.</p></div><div className="channel-pills"><span>Google</span><span>Website</span><span>Instagram</span><span>Facebook</span></div></div>
          <div className="wizard-result-actions"><AppLink className="button" to={`/app/projects/${project.id}`}>Projekt öffnen<AppIcon name="arrow" /></AppLink><AppLink className="button button-secondary" to="/app">Zur Übersicht</AppLink></div>
        </section>
      )}
    </div>
  );
}
