import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authService, type AuthUser, type RegisterResult } from '../services/auth';
import { navigate } from '../lib/router';

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string) => Promise<RegisterResult>;
  logout: () => Promise<void>;
  startGoogle: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const result = await authService.me();
      setUser(result.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleResult = params.get('auth');

    void refresh().then(() => {
      if (googleResult === 'google_success') {
        window.history.replaceState({}, '', '/app');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    });
  }, []);

  async function login(email: string, password: string) {
    const result = await authService.login(email, password);
    setUser(result.user);
    return result.user;
  }

  async function register(email: string, password: string) {
    return authService.register({ email, password });
  }

  async function logout() {
    try {
      await authService.logout();
    } finally {
      setUser(null);
      navigate('/');
    }
  }

  function startGoogle() {
    window.location.assign(authService.googleStartUrl());
  }

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    login,
    register,
    logout,
    startGoogle,
    refresh,
  }), [loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
