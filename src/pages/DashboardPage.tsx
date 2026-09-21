import AppLink from '../components/AppLink';
import AppIcon from '../components/AppIcon';
import EmptyState from '../components/EmptyState';
import ProjectCard from '../components/ProjectCard';
import { useAuth } from '../contexts/AuthContext';
import { useUserArea } from '../contexts/UserAreaContext';

export default function DashboardPage() {
  const { user } = useAuth();
  const { projects, profile } = useUserArea();
  if (projects.length === 0) return <EmptyState />;
  const displayName = profile.name || user?.email.split('@')[0] || 'Willkommen';

  return (
    <div className="app-page">
      <header className="app-page-heading app-page-heading-row"><div><span className="app-kicker">Übersicht</span><h1>Hallo, {displayName}</h1><p>Hier findest du deine letzten Arbeiten und kannst direkt weitermachen.</p></div><AppLink className="button app-primary-action" to="/app/new"><AppIcon name="plus" />Neues Projekt</AppLink></header>
      <section className="dashboard-section"><div className="section-title-row"><div><h2>Letzte Projekte</h2><p>Deine zuletzt erstellten Inhalte.</p></div><AppLink className="quiet-link" to="/app/projects">Alle Projekte<AppIcon name="arrow" /></AppLink></div><div className="recent-projects">{projects.slice(0, 4).map(project => <ProjectCard project={project} compact key={project.id} />)}</div></section>
      <section className="dashboard-help"><span><AppIcon name="spark" /></span><div><strong>Eine fertige Arbeit. Viele Möglichkeiten.</strong><p>Du machst die Arbeit. DFBK.app macht sie sichtbar.</p></div><AppLink className="quiet-link" to="/app/new">Content erstellen<AppIcon name="arrow" /></AppLink></section>
    </div>
  );
}
