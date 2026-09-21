import type { ReactNode } from 'react';
import AppLink from './AppLink';
import AppIcon from './AppIcon';
import { usePathname } from '../lib/router';
import { useAuth } from '../contexts/AuthContext';
import { useUserArea } from '../contexts/UserAreaContext';

const primaryItems = [
  { to: '/app', label: 'Übersicht', icon: 'home' as const, exact: true },
  { to: '/app/projects', label: 'Projekte', icon: 'folder' as const },
  { to: '/app/new', label: 'Neues Projekt', icon: 'plus' as const, accent: true },
];

const secondaryItems = [
  { to: '/app/settings', label: 'Einstellungen', icon: 'settings' as const },
  { to: '/app/billing', label: 'Tarif', icon: 'card' as const },
];

function NavItem({ item, pathname }: { item: (typeof primaryItems)[number] | (typeof secondaryItems)[number]; pathname: string }) {
  const active = 'exact' in item && item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);
  return <AppLink className={`app-nav-link${active ? ' is-active' : ''}${'accent' in item && item.accent ? ' is-accent' : ''}`} to={item.to}><AppIcon name={item.icon} /><span>{item.label}</span></AppLink>;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { profile } = useUserArea();
  const pathname = usePathname();
  const displayName = profile.name || user?.email.split('@')[0] || 'Mein Bereich';
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <AppLink className="app-brand" to="/" aria-label="DFBK.app Startseite"><img src="/brand/dfbk-logo.svg" alt="DFBK.app" /></AppLink>
        <nav className="app-sidebar-nav" aria-label="Persönlicher Bereich">
          <div>{primaryItems.map(item => <NavItem item={item} pathname={pathname} key={item.to} />)}</div>
          <div className="app-sidebar-secondary">{secondaryItems.map(item => <NavItem item={item} pathname={pathname} key={item.to} />)}</div>
        </nav>
        <AppLink className="app-user-card" to="/app/settings">
          <span className="app-avatar">{initials}</span>
          <span><strong>{displayName}</strong><small>{user?.email}</small></span>
        </AppLink>
      </aside>

      <div className="app-workspace">
        <header className="app-topbar">
          <AppLink className="app-mobile-brand" to="/"><img src="/brand/dfbk-logo.svg" alt="DFBK.app" /></AppLink>
          <AppLink className="app-topbar-user" to="/app/settings" aria-label="Profil und Einstellungen"><span className="app-avatar">{initials}</span><span>Mein Bereich</span></AppLink>
        </header>
        <main className="app-main">{children}</main>
      </div>

      <nav className="app-bottom-nav" aria-label="Mobile Navigation">
        <NavItem item={primaryItems[0]} pathname={pathname} />
        <NavItem item={primaryItems[1]} pathname={pathname} />
        <NavItem item={primaryItems[2]} pathname={pathname} />
        <NavItem item={secondaryItems[0]} pathname={pathname} />
      </nav>
    </div>
  );
}
