import { useCallback, useEffect, useRef, useState } from 'react';
import AppIcon from '../components/AppIcon';
import AppLink from '../components/AppLink';
import ChannelCard from '../components/ChannelCard';
import DescriptionInput from '../components/DescriptionInput';
import PhotoUploader from '../components/PhotoUploader';
import ProcessingState from '../components/ProcessingState';
import { useUserArea, type AppProject } from '../contexts/UserAreaContext';

type Step = 1 | 2 | 3 | 4;

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

async function optimizePhoto(file: File) {
  const original = await fileToDataUrl(file);
  const image = await loadImage(original);
  const maxEdge = 1400;
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) return original;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const optimized = canvas.toDataURL('image/webp', 0.78);
  return optimized.length < original.length ? optimized : original;
}

export default function CreateProjectPage() {
  const { createProject, updateContent } = useUserArea();
  const [step, setStep] = useState<Step>(1);
  const [image, setImage] = useState('');
  const [description, setDescription] = useState('');
  const [project, setProject] = useState<AppProject | null>(null);
  const createdRef = useRef(false);

  useEffect(() => () => { if (image.startsWith('blob:')) URL.revokeObjectURL(image); }, [image]);

  async function selectPhoto(file: File) {
    try {
      setImage(await optimizePhoto(file));
    } catch {
      setImage(URL.createObjectURL(file));
    }
  }

  const finishProcessing = useCallback(() => {
    if (createdRef.current) return;
    createdRef.current = true;
    setProject(createProject({ description, image }));
    setStep(4);
  }, [createProject, description, image]);

  return (
    <div className="app-page app-wizard-page">
      <nav className="wizard-progress" aria-label="Projektfortschritt">{['Foto', 'Beschreibung', 'DFBK.app', 'Ergebnis'].map((label, index) => { const number = index + 1; return <span className={number === step ? 'is-active' : number < step ? 'is-done' : ''} key={label}><i>{number < step ? <AppIcon name="check" /> : number}</i><b>{label}</b></span>; })}</nav>
      {step === 1 && <PhotoUploader preview={image} onSelect={selectPhoto} onContinue={() => setStep(2)} />}
      {step === 2 && <DescriptionInput value={description} onChange={setDescription} onBack={() => setStep(1)} onContinue={() => setStep(3)} />}
      {step === 3 && <ProcessingState onComplete={finishProcessing} />}
      {step === 4 && project && (
        <section className="wizard-result">
          <header className="wizard-heading center"><span className="result-check"><AppIcon name="check" /></span><span className="app-kicker">Schritt 4</span><h1>Dein Content ist fertig</h1><p>Du kannst die Texte direkt verwenden oder noch bearbeiten.</p></header>
          <div className="result-photo-summary"><img src={project.optimizedImage} alt="Fertiges Projekt" /><div><span className="project-status status-content-erstellt"><AppIcon name="check" />Content erstellt</span><h2>{project.title}</h2><p>{project.description}</p><a className="button button-secondary" href={project.optimizedImage} download="dfbk-projektbild"><AppIcon name="download" />Bild herunterladen</a></div></div>
          <div className="channel-list">{(['google', 'social', 'website'] as const).map(channel => <ChannelCard channel={channel} value={project.content[channel]} onChange={value => updateContent(project.id, channel, value)} key={channel} />)}</div>
          <div className="visibility-panel"><div><span className="app-kicker">Sichtbar werden</span><h2>Bereit für deine Kanäle</h2><p>Text kopieren, Bild herunterladen und dort einsetzen, wo deine Kunden dich finden.</p></div><div className="channel-pills"><span>Google</span><span>Website</span><span>Instagram</span><span>Facebook</span></div></div>
          <div className="wizard-result-actions"><AppLink className="button" to={`/app/projects/${project.id}`}>Projekt öffnen<AppIcon name="arrow" /></AppLink><AppLink className="button button-secondary" to="/app">Zur Übersicht</AppLink></div>
        </section>
      )}
    </div>
  );
}
