import { useEffect } from 'react';
import { usePathname } from './lib/router';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import DashboardPage from './pages/DashboardPage';
import CreateProjectPage from './pages/CreateProjectPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import IntegrationsPage from './pages/IntegrationsPage';
import SettingsPage from './pages/SettingsPage';
import PricingPage from './pages/PricingPage';
import BillingPage from './pages/BillingPage';
import HelpPage from './pages/HelpPage';
import LegalPage from './pages/LegalPage';
import NotFoundPage from './pages/NotFoundPage';
import EmailVerificationPage from './pages/EmailVerificationPage';
import AppAccessGate from './components/AppAccessGate';
import { navigate } from './lib/router';

function Redirect({ to }: { to: string }) {
  useEffect(() => navigate(to), [to]);
  return null;
}

export default function App() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === '/' && window.location.hash) {
      requestAnimationFrame(() => document.querySelector(window.location.hash)?.scrollIntoView());
    }
  }, [pathname]);

  if (pathname === '/') return <HomePage />;
  if (pathname === '/login') return <LoginPage />;
  if (pathname === '/register') return <RegisterPage />;
  if (pathname === '/forgot-password') return <ForgotPasswordPage />;
  if (pathname === '/verify-email') return <EmailVerificationPage />;
  if (pathname === '/app') return <AppAccessGate><DashboardPage /></AppAccessGate>;
  if (pathname === '/app/new') return <AppAccessGate><CreateProjectPage /></AppAccessGate>;
  if (pathname === '/app/projects') return <AppAccessGate><ProjectsPage /></AppAccessGate>;
  if (pathname.startsWith('/app/projects/')) return <AppAccessGate><ProjectDetailPage id={pathname.split('/').filter(Boolean)[2] || '---'} /></AppAccessGate>;
  if (pathname === '/app/settings') return <AppAccessGate><SettingsPage /></AppAccessGate>;
  if (pathname === '/app/billing') return <AppAccessGate><BillingPage /></AppAccessGate>;
  if (pathname === '/dashboard') return <Redirect to="/app" />;
  if (pathname === '/create') return <Redirect to="/app/new" />;
  if (pathname === '/result') return <Redirect to="/app/projects" />;
  if (pathname === '/projects' || pathname.startsWith('/projects/')) return <Redirect to="/app/projects" />;
  if (pathname === '/profile' || pathname === '/settings') return <Redirect to="/app/settings" />;
  if (pathname === '/billing') return <Redirect to="/app/billing" />;
  if (pathname === '/integrations') return <IntegrationsPage />;
  if (pathname === '/pricing') return <PricingPage />;
  if (pathname === '/help') return <HelpPage />;
  if (pathname === '/impressum') return <LegalPage type="impressum" />;
  if (pathname === '/datenschutz') return <LegalPage type="datenschutz" />;
  if (pathname === '/nutzungsbedingungen') return <LegalPage type="nutzungsbedingungen" />;
  if (pathname === '/agb') return <LegalPage type="agb" />;
  if (pathname === '/widerruf') return <LegalPage type="widerruf" />;
  return <NotFoundPage />;
}
