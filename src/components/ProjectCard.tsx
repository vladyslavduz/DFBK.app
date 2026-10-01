import AppLink from './AppLink';
import AppIcon from './AppIcon';
import { projectStatusLabel, type AppProject } from '../contexts/UserAreaContext';

const dateFormatter = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

export default function ProjectCard({ project, compact = false }: { project: AppProject; compact?: boolean }) {
  const coverImage = project.optimizedImage || project.originalImage;

  return (
    <AppLink className={`project-card${compact ? ' is-compact' : ''}`} to={`/app/projects/${project.id}`}>
      {coverImage ? <img src={coverImage} alt="" /> : <span className="project-card-image-missing">Kein Bild verfügbar</span>}
      <span className="project-card-copy">
        <span className={`project-status status-${project.status}`}><AppIcon name="check" />{projectStatusLabel(project.status)}</span>
        <strong>{project.title}</strong>
        <small>{dateFormatter.format(new Date(project.createdAt))}</small>
      </span>
      <AppIcon name="arrow" />
    </AppLink>
  );
}
