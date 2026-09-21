import { useCallback, type ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';
import AppLayout from './AppLayout';
import AppIcon from './AppIcon';
import { navigate } from '../lib/router';

export default function AppAccessGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const close = useCallback(() => navigate('/'), []);

  if (loading) {
    return <div className="app-gate-loading"><span className="processing-orb"><AppIcon name="spark" /></span><strong>DFBK.app wird vorbereitet</strong></div>;
  }

  if (!user) {
    return (
      <div className="app-gate-background">
        <div className="app-gate-preview" aria-hidden="true"><img src="/brand/dfbk-logo.svg" alt="" /><div /><div /><div /></div>
        <AuthModal open initialMode="login" onClose={close} onAuthenticated={() => navigate('/app')} />
      </div>
    );
  }

  return <AppLayout>{children}</AppLayout>;
}
