import AppLink from './AppLink';
import AppIcon from './AppIcon';
import type { AppProject } from '../contexts/UserAreaContext';

const dateFormatter = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

export default function ProjectCard({ project, compact = false }: { project: AppProject; compact?: boolean }) {
  return (
    <AppLink className={`project-card${compact ? ' is-compact' : ''}`} to={`/app/projects/${project.id}`}>
      <img src={project.optimizedImage} alt="" />
      <span className="project-card-copy">
        <span className={`project-status status-${project.status.toLowerCase().replace(' ', '-')}`}><AppIcon name="check" />{project.status}</span>
        <strong>{project.title}</strong>
        <small>{dateFormatter.format(new Date(project.createdAt))}</small>
      </span>
      <AppIcon name="arrow" />
    </AppLink>
  );
}
