import PageShell from '../components/PageShell';
import AppLink from '../components/AppLink';

export default function DashboardPage() {
  return <PageShell eyebrow="Projekt Dashboard" title="Dein Marketing aus echten Arbeitsfotos" intro="Zentrale Übersicht für neue Inhalte, Projekte, Veröffentlichungen und Integrationen."><div className="dashboard-grid"><AppLink className="card action-card" to="/create"><h3>+ Neues Projekt</h3><p>Fotos hochladen und Content vorbereiten.</p></AppLink><AppLink className="card action-card" to="/projects"><h3>Projekte</h3><p>Referenzen und bisherige Arbeiten verwalten.</p></AppLink><AppLink className="card action-card" to="/integrations"><h3>Integrationen</h3><p>Google, Meta, Telegram und weitere Kanäle.</p></AppLink><AppLink className="card action-card" to="/profile"><h3>Betriebsprofil</h3><p>DFBK lernt deinen Betrieb einmalig kennen.</p></AppLink></div></PageShell>;
}
