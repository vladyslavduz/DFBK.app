import { useEffect } from 'react';
import { usePathname } from './lib/router';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import DashboardPage from './pages/DashboardPage';
import CreateProjectPage from './pages/CreateProjectPage';
import ResultPage from './pages/ResultPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import ProfilePage from './pages/ProfilePage';
import IntegrationsPage from './pages/IntegrationsPage';
import SettingsPage from './pages/SettingsPage';
import PricingPage from './pages/PricingPage';
import BillingPage from './pages/BillingPage';
import HelpPage from './pages/HelpPage';
import LegalPage from './pages/LegalPage';
import NotFoundPage from './pages/NotFoundPage';

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
  if (pathname === '/dashboard') return <DashboardPage />;
  if (pathname === '/create') return <CreateProjectPage />;
  if (pathname === '/result') return <ResultPage />;
  if (pathname === '/projects') return <ProjectsPage />;
  if (pathname.startsWith('/projects/')) return <ProjectDetailPage id={pathname.split('/').filter(Boolean)[1] || '---'} />;
  if (pathname === '/profile') return <ProfilePage />;
  if (pathname === '/integrations') return <IntegrationsPage />;
  if (pathname === '/settings') return <SettingsPage />;
  if (pathname === '/pricing') return <PricingPage />;
  if (pathname === '/billing') return <BillingPage />;
  if (pathname === '/help') return <HelpPage />;
  if (pathname === '/impressum') return <LegalPage type="impressum" />;
  if (pathname === '/datenschutz') return <LegalPage type="datenschutz" />;
  if (pathname === '/agb') return <LegalPage type="agb" />;
  if (pathname === '/widerruf') return <LegalPage type="widerruf" />;
  return <NotFoundPage />;
}
