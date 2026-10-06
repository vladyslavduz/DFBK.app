import { useState } from 'react';
import AppLink from './AppLink';
import AppIcon from './AppIcon';
import ProjectRename from './ProjectRename';
import { projectStatusLabel, type AppProject } from '../contexts/UserAreaContext';
import { formatProjectDate } from '../lib/project-date';

export default function ProjectCard({ project, compact = false }: { project: AppProject; compact?: boolean }) {
  const coverImage = project.optimizedImage || project.originalImage;
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <article className={`project-card${compact ? ' is-compact' : ''}`}>
      <AppLink className="project-card-open" to={`/app/projects/${project.id}`}>
        <span className="project-card-media">
          {coverImage && !imageFailed
            ? <img src={coverImage} alt="" onError={() => setImageFailed(true)} />
            : <span className="project-card-image-missing"><AppIcon name="image" />Kein Bild verfügbar</span>}
        </span>
        <span className="project-card-copy">
          <span className={`project-status status-${project.status}`}>{projectStatusLabel(project.status)}</span>
          <strong>{project.title}</strong>
          <small>{formatProjectDate(project.createdAt)}</small>
        </span>
        {compact && <AppIcon name="arrow" />}
      </AppLink>
      <ProjectRename projectId={project.id} title={project.title} compact={compact} />
    </article>
  );
}
