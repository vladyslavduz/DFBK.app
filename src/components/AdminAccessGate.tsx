import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ApiError } from '../lib/api';
import { navigate } from '../lib/router';
import { adminService } from '../services/admin';
import AppIcon from './AppIcon';
import AppLayout from './AppLayout';
import AuthModal from './AuthModal';

type AccessState = 'checking' | 'allowed' | 'denied' | 'error';

export default function AdminAccessGate({ children }: { children: ReactNode }) {
  const { user, loading, refresh } = useAuth();
  const [access, setAccess] = useState<AccessState>('checking');
  const [message, setMessage] = useState('');
  const requestId = useRef(0);

  const verifyAdmin = useCallback(async () => {
    if (!user) {
      setAccess('checking');
      setMessage('');
      return;
    }

    const currentRequest = ++requestId.current;
    setAccess('checking');
    setMessage('');

    try {
      await adminService.me();
      if (currentRequest !== requestId.current) return;
      setAccess('allowed');
    } catch (error) {
      if (currentRequest !== requestId.current) return;
      if (error instanceof ApiError && error.status === 401) {
        requestId.current += 1;
        setAccess('checking');
        setMessage('');
        await refresh();
        return;
      }
      if (error instanceof ApiError && error.status === 403) {
        setAccess('denied');
        setMessage('Du hast keinen Zugriff auf die Administration.');
        return;
      }
      setAccess('error');
      setMessage('Der Administrator-Zugriff konnte nicht geprüft werden.');
    }
  }, [refresh, user]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      requestId.current += 1;
      setAccess('checking');
      setMessage('');
      return;
    }
    void verifyAdmin();
    return () => { requestId.current += 1; };
  }, [loading, user?.id, verifyAdmin]);

  if (loading) {
    return <div className="app-gate-loading"><span className="processing-orb"><AppIcon name="spark" /></span><strong>Zugriff wird geprüft</strong></div>;
  }

  if (!user) {
    return (
      <div className="app-gate-background">
        <div className="app-gate-preview" aria-hidden="true"><img src="/brand/dfbk-logo.svg" alt="" /><div /><div /><div /></div>
        <AuthModal open initialMode="login" onClose={() => navigate('/')} onAuthenticated={() => {}} />
      </div>
    );
  }

  if (access === 'checking') {
    return <div className="app-gate-loading" aria-live="polite"><span className="processing-orb"><AppIcon name="spark" /></span><strong>Administrator-Zugriff wird geprüft</strong></div>;
  }

  if (access === 'denied') {
    return (
      <AppLayout>
        <div className="app-page"><section className="admin-access-state" role="alert"><AppIcon name="user" /><h1>Kein Zugriff</h1><p>{message}</p><button className="button button-secondary" type="button" onClick={() => navigate('/app')}>Zum persönlichen Bereich</button></section></div>
      </AppLayout>
    );
  }

  if (access === 'error') {
    return (
      <AppLayout>
        <div className="app-page"><section className="admin-access-state" role="alert"><AppIcon name="settings" /><h1>Zugriff konnte nicht geprüft werden</h1><p>{message}</p><button className="button" type="button" onClick={() => void verifyAdmin()}>Erneut prüfen</button></section></div>
      </AppLayout>
    );
  }

  return <AppLayout>{children}</AppLayout>;
}
