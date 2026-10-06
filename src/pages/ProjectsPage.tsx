import { useMemo, useState } from 'react';
import AppIcon from '../components/AppIcon';
import AppLink from '../components/AppLink';
import EmptyState from '../components/EmptyState';
import ProjectCard from '../components/ProjectCard';
import { useUserArea } from '../contexts/UserAreaContext';
import { projectDateValue } from '../lib/project-date';

type SortMode = 'newest' | 'oldest' | 'az' | 'za';
type ViewMode = 'cards' | 'list';
const VIEW_KEY = 'dfbk.projects.view.v1';

function readViewPreference(): ViewMode {
  try {
    return window.localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'cards';
  } catch {
    return 'cards';
  }
}

export default function ProjectsPage() {
  const { projects, projectsLoading, projectsError, reloadProjects, plan, planLoading } = useUserArea();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('newest');
  const [view, setView] = useState<ViewMode>(() => readViewPreference());

  const visibleProjects = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('de-DE');
    const filtered = needle ? projects.filter(project => project.title.toLocaleLowerCase('de-DE').includes(needle)) : [...projects];
    const collator = new Intl.Collator('de-DE', { sensitivity: 'base' });
    return filtered.sort((a, b) => {
      if (sort === 'oldest') return projectDateValue(a.createdAt) - projectDateValue(b.createdAt);
      if (sort === 'az') return collator.compare(a.title, b.title);
      if (sort === 'za') return collator.compare(b.title, a.title);
      return projectDateValue(b.createdAt) - projectDateValue(a.createdAt);
    });
  }, [projects, query, sort]);

  function setViewMode(next: ViewMode) {
    setView(next);
    try { window.localStorage.setItem(VIEW_KEY, next); } catch { /* preference is optional */ }
  }

  if (projectsLoading) return <div className="app-empty-card" aria-live="polite"><span className="processing-orb"><AppIcon name="spark" /></span><h1>Projekte werden geladen</h1></div>;
  if (projectsError) return <div className="app-empty-card"><AppIcon name="folder" /><h1>Projekte konnten nicht geladen werden</h1><p>{projectsError}</p><button className="button" type="button" onClick={() => void reloadProjects()}>Erneut laden</button></div>;
  if (projects.length === 0) return <EmptyState />;

  const usage = plan.source === 'backend' ? plan.usage : null;
  const trialUsage = plan.plan === 'trial' && usage?.projectsLimit !== null ? usage : null;

  return (
    <div className="app-page projects-library-page">
      <header className="app-page-heading app-page-heading-row"><div><span className="app-kicker">Meine Projekte</span><h1>Meine Projekte</h1><p>Deine Arbeiten und fertigen Inhalte an einem Ort.</p></div><AppLink className="button app-primary-action" to="/app/new"><AppIcon name="plus" />Neues Projekt</AppLink></header>

      {!planLoading && trialUsage && (
        <section className="trial-progress-card" aria-label="Testphase">
          <div><span className="app-kicker">Testphase</span><strong>{trialUsage.projectsUsed} von {trialUsage.projectsLimit} Projekten verwendet</strong></div>
          <progress max={trialUsage.projectsLimit || 1} value={Math.min(trialUsage.projectsUsed, trialUsage.projectsLimit || 1)} />
        </section>
      )}
      {!planLoading && plan.source === 'backend' && plan.plan === 'business' && <div className="business-plan-badge">Business</div>}

      <section className="project-library-controls" aria-label="Projektansicht">
        <label className="project-search"><span className="sr-only">Projekte durchsuchen</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Projekte durchsuchen…" /></label>
        <select value={sort} onChange={event => setSort(event.target.value as SortMode)} aria-label="Projekte sortieren">
          <option value="newest">Neueste zuerst</option>
          <option value="oldest">Älteste zuerst</option>
          <option value="az">Name A–Z</option>
          <option value="za">Name Z–A</option>
        </select>
        <div className="project-view-switch" role="group" aria-label="Ansicht wählen">
          <button type="button" className={view === 'cards' ? 'is-active' : ''} onClick={() => setViewMode('cards')} aria-pressed={view === 'cards'}>Kartenansicht</button>
          <button type="button" className={view === 'list' ? 'is-active' : ''} onClick={() => setViewMode('list')} aria-pressed={view === 'list'}>Listenansicht</button>
        </div>
      </section>

      {visibleProjects.length === 0 ? (
        <section className="project-search-empty"><h2>Keine Projekte gefunden.</h2><button className="button button-secondary" type="button" onClick={() => setQuery('')}>Suche zurücksetzen</button></section>
      ) : (
        <div className={view === 'cards' ? 'project-grid' : 'project-list'}>{visibleProjects.map(project => <ProjectCard project={project} compact={view === 'list'} key={project.id} />)}</div>
      )}
    </div>
  );
}
