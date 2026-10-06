import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { ApiError } from '../lib/api';
import {
  socialService,
  type PublishPayload,
  type PublicationResponse,
  type SocialConnection,
  type SocialProvider,
} from '../services/social';

export type SocialDraft = {
  projectId: string;
  caption: string;
  providers: Array<'instagram' | 'facebook'>;
  mediaId: string | null;
  useOptimizedImage: boolean;
};

export type SocialAttempt = {
  projectId: string;
  key: string;
  payload: PublishPayload;
  requestId: string | null;
};

type SocialContextValue = {
  connections: SocialConnection[];
  loading: boolean;
  unavailable: boolean;
  error: string | null;
  refreshConnections: () => Promise<SocialConnection[]>;
  connect: (provider: 'instagram' | 'facebook') => void;
  selectAccount: (provider: 'instagram' | 'facebook', connectionId: string) => Promise<void>;
  disconnect: (provider: 'instagram' | 'facebook') => Promise<void>;
  publish: (projectId: string, payload: PublishPayload, idempotencyKey: string) => ReturnType<typeof socialService.publish>;
  getPublication: (projectId: string, requestId: string) => Promise<PublicationResponse>;
  draft: SocialDraft | null;
  saveDraft: (draft: SocialDraft | null) => void;
  attempt: SocialAttempt | null;
  saveAttempt: (attempt: SocialAttempt | null) => void;
};

const SocialContext = createContext<SocialContextValue | null>(null);
const STORAGE_PREFIX = 'dfbk.social.v1';

function storageKey(userId: string, suffix: string) {
  return `${STORAGE_PREFIX}.${userId}.${suffix}`;
}

function safeRead<T>(key: string): T | null {
  try {
    const value = window.sessionStorage.getItem(key);
    return value ? JSON.parse(value) as T : null;
  } catch {
    return null;
  }
}

function safeWrite(key: string, value: unknown) {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Session persistence is optional; in-memory state remains authoritative.
  }
}

export function SocialPublishingProvider({ children }: { children: ReactNode }) {
  const { user, refresh: refreshAuth } = useAuth();
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<SocialDraft | null>(null);
  const [attempt, setAttempt] = useState<SocialAttempt | null>(null);
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    const previous = previousUserId.current;
    if (previous && previous !== user?.id) {
      safeWrite(storageKey(previous, 'draft'), null);
      safeWrite(storageKey(previous, 'attempt'), null);
    }
    previousUserId.current = user?.id || null;

    if (!user) {
      setConnections([]);
      setDraft(null);
      setAttempt(null);
      setUnavailable(false);
      setError(null);
      return;
    }

    setDraft(safeRead<SocialDraft>(storageKey(user.id, 'draft')));
    setAttempt(safeRead<SocialAttempt>(storageKey(user.id, 'attempt')));
  }, [user?.id]);

  const refreshConnections = useCallback(async () => {
    if (!user) {
      setConnections([]);
      return [];
    }
    setLoading(true);
    setError(null);
    try {
      const next = await socialService.getConnections();
      setConnections(next);
      setUnavailable(false);
      return next;
    } catch (requestError) {
      setConnections([]);
      if (requestError instanceof ApiError && requestError.status === 401) {
        await refreshAuth();
      }
      if (
        requestError instanceof ApiError &&
        (requestError.status === 404 || requestError.status === 503 ||
          ['SOCIAL_NOT_CONFIGURED', 'SOCIAL_PROVIDER_NOT_AVAILABLE', 'SOCIAL_SERVICE_UNAVAILABLE'].includes(requestError.code))
      ) {
        setUnavailable(true);
        setError(null);
      } else {
        setUnavailable(false);
        setError('Social-Media-Verbindungen konnten nicht geladen werden.');
      }
      return [];
    } finally {
      setLoading(false);
    }
  }, [refreshAuth, user]);

  useEffect(() => {
    if (user) void refreshConnections();
  }, [refreshConnections, user]);

  function connect(provider: 'instagram' | 'facebook') {
    if (!user) return;
    window.location.assign(socialService.connectUrl(provider));
  }

  const selectAccount = useCallback(async (provider: 'instagram' | 'facebook', connectionId: string) => {
    const next = await socialService.selectAccount(provider, connectionId);
    setConnections(next);
    setUnavailable(false);
  }, []);

  const disconnect = useCallback(async (provider: 'instagram' | 'facebook') => {
    const next = await socialService.disconnect(provider);
    setConnections(next);
    setUnavailable(false);
  }, []);

  function saveDraft(next: SocialDraft | null) {
    setDraft(next);
    if (user) safeWrite(storageKey(user.id, 'draft'), next);
  }

  function saveAttempt(next: SocialAttempt | null) {
    setAttempt(next);
    if (user) safeWrite(storageKey(user.id, 'attempt'), next);
  }

  const value = useMemo<SocialContextValue>(() => ({
    connections,
    loading,
    unavailable,
    error,
    refreshConnections,
    connect,
    selectAccount,
    disconnect,
    publish: socialService.publish,
    getPublication: socialService.getPublication,
    draft,
    saveDraft,
    attempt,
    saveAttempt,
  }), [attempt, connections, disconnect, draft, error, loading, refreshConnections, selectAccount, unavailable]);

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}

export function useSocialPublishing() {
  const context = useContext(SocialContext);
  if (!context) throw new Error('useSocialPublishing must be used inside SocialPublishingProvider');
  return context;
}

export function connectionForProvider(connections: SocialConnection[], provider: SocialProvider) {
  return connections.find(connection => connection.provider === provider) || null;
}
