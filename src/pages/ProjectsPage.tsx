import AppIcon from '../components/AppIcon';
import AppLink from '../components/AppLink';
import EmptyState from '../components/EmptyState';
import ProjectCard from '../components/ProjectCard';
import { useUserArea } from '../contexts/UserAreaContext';

export default function ProjectsPage() {
  const { projects } = useUserArea();
  if (projects.length === 0) return <EmptyState />;
  return <div className="app-page"><header className="app-page-heading app-page-heading-row"><div><span className="app-kicker">Meine Projekte</span><h1>Deine Arbeiten</h1><p>Alle Projekte und fertigen Inhalte an einem Ort.</p></div><AppLink className="button app-primary-action" to="/app/new"><AppIcon name="plus" />Neues Projekt</AppLink></header><div className="project-grid">{projects.map(project => <ProjectCard project={project} key={project.id} />)}</div></div>;
}
