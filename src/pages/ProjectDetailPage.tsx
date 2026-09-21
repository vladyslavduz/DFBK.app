import { useState } from 'react';
import AppIcon from '../components/AppIcon';
import AppLink from '../components/AppLink';
import ChannelCard from '../components/ChannelCard';
import { useUserArea } from '../contexts/UserAreaContext';

export default function ProjectDetailPage({ id }: { id: string }) {
  const { projects, updateContent } = useUserArea();
  const [imageMode, setImageMode] = useState<'optimized' | 'original'>('optimized');
  const project = projects.find(item => item.id === id);

  if (!project) return <div className="app-page"><div className="app-empty-card"><AppIcon name="folder" /><h1>Projekt nicht gefunden</h1><p>Dieses Projekt ist nicht verfügbar oder wurde bereits entfernt.</p><AppLink className="button" to="/app/projects">Zu meinen Projekten</AppLink></div></div>;

  const image = imageMode === 'optimized' ? project.optimizedImage : project.originalImage;
  return (
    <div className="app-page">
      <AppLink className="back-link" to="/app/projects">← Meine Projekte</AppLink>
      <header className="app-page-heading project-detail-heading"><div><span className="project-status status-content-erstellt"><AppIcon name="check" />{project.status}</span><h1>{project.title}</h1><p>{new Intl.DateTimeFormat('de-DE', { dateStyle: 'long' }).format(new Date(project.createdAt))}</p></div></header>
      <section className="project-image-card"><div className="image-toggle"><button className={imageMode === 'original' ? 'is-active' : ''} onClick={() => setImageMode('original')} type="button">Original</button><button className={imageMode === 'optimized' ? 'is-active' : ''} onClick={() => setImageMode('optimized')} type="button">Optimiert</button></div><img className={imageMode === 'optimized' ? 'is-optimized' : ''} src={image} alt="Projektaufnahme" /><div className="project-image-actions"><a className="button button-secondary" href={image} download="dfbk-projektbild"><AppIcon name="download" />Herunterladen</a></div></section>
      <section className="project-description"><span className="app-kicker">Beschreibung</span><h2>Über diese Arbeit</h2><p>{project.description}</p></section>
      <section><div className="section-title-row"><div><span className="app-kicker">Erstellte Inhalte</span><h2>Fertig für deine Kunden</h2></div></div><div className="channel-list">{(['google', 'social', 'website'] as const).map(channel => <ChannelCard channel={channel} value={project.content[channel]} onChange={value => updateContent(project.id, channel, value)} key={channel} />)}</div></section>
      <section className="visibility-panel"><div><span className="app-kicker">Sichtbar werden</span><h2>Content verwenden</h2><p>Kopiere deine Texte und lade das Bild für Website, Google oder Social Media herunter.</p></div><div className="channel-pills"><span>Google</span><span>Website</span><span>Instagram</span><span>Facebook</span></div></section>
    </div>
  );
}
