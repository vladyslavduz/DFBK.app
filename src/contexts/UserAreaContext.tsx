import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { ApiError } from '../lib/api';
import { projectService } from '../services/projects';
import type { MediaAsset, Project, ProjectStatus } from '../types/models';

export type AppProjectStatus = 'Entwurf' | 'Content erstellt' | 'Fertig';
export type ContentChannel = 'google' | 'social' | 'website';

export type ProjectContent = Record<ContentChannel, string>;

export type AppProject = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  apiStatus: ProjectStatus;
  status: AppProjectStatus;
  originalImage: string;
  optimizedImage: string;
  content: ProjectContent;
};

export type LocalProfile = {
  name: string;
  company: string;
};

type NewProjectInput = {
  title?: string;
  description: string;
};

type UserAreaContextValue = {
  projects: AppProject[];
  projectsLoading: boolean;
  projectsError: string | null;
  profile: LocalProfile;
  reloadProjects: () => Promise<void>;
  getProject: (id: string) => Promise<AppProject>;
  createProject: (input: NewProjectInput) => Promise<AppProject>;
  uploadProjectMedia: (projectId: string, file: File) => Promise<MediaAsset>;
  updateContent: (projectId: string, channel: ContentChannel, value: string) => void;
  updateProfile: (profile: LocalProfile) => void;
};

const PROFILE_KEY = 'dfbk.user-area.profile.v1';
const FALLBACK_IMAGE = '/visual/dfbk-showcase/assets/images/renovierung-after.webp';

const UserAreaContext = createContext<UserAreaContextValue | null>(null);

function readStorage<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function makeTitle(description: string) {
  const firstSentence = description.split(/[.!?\n]/)[0]?.trim();
  if (!firstSentence) return 'Mein neues Projekt';
  return firstSentence.length > 48 ? `${firstSentence.slice(0, 45)}…` : firstSentence;
}

function makeContent(description: string): ProjectContent {
  const detail = description.trim() || 'Eine Arbeit wurde sorgfältig und fachgerecht abgeschlossen.';
  return {
    google: `${detail}\n\nDas Ergebnis ist fertig und bereit, sichtbar zu werden. Kontaktiere uns gerne für dein nächstes Projekt.`,
    social: `Fertiggestellt ✓\n\n${detail}\n\nDu planst etwas Ähnliches? Schreib uns gerne eine Nachricht.`,
    website: `${detail}\n\nBei diesem Projekt standen eine saubere Ausführung, verlässliche Abläufe und ein überzeugendes Ergebnis im Mittelpunkt.`,
  };
}

function toAppStatus(status: ProjectStatus): AppProjectStatus {
  if (status === 'draft') return 'Entwurf';
  if (status === 'processing') return 'Content erstellt';
  return 'Fertig';
}

function toAppProject(project: Project): AppProject {
  const description = project.description || '';
  return {
    ...project,
    description,
    apiStatus: project.status,
    status: toAppStatus(project.status),
    originalImage: FALLBACK_IMAGE,
    optimizedImage: FALLBACK_IMAGE,
    content: makeContent(description),
  };
}

function projectLoadMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 401) return null;
  return 'Etwas ist schiefgelaufen. Bitte versuche es erneut.';
}

export function UserAreaProvider({ children }: { children: ReactNode }) {
  const { user, refresh } = useAuth();
  const ownerId = user?.id || 'guest';
  const profileKey = `${PROFILE_KEY}.${ownerId}`;
  const [storageOwner, setStorageOwner] = useState(ownerId);
  const [projects, setProjects] = useState<AppProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [loadedProjectsOwner, setLoadedProjectsOwner] = useState<string | null>(null);
  const [profile, setProfile] = useState<LocalProfile>(() => readStorage(profileKey, { name: '', company: '' }));

  useEffect(() => {
    if (storageOwner === ownerId) return;
    setProfile(readStorage(`${PROFILE_KEY}.${ownerId}`, { name: '', company: '' }));
    setStorageOwner(ownerId);
  }, [ownerId, storageOwner]);

  useEffect(() => {
    if (storageOwner !== ownerId) return;
    try { window.localStorage.setItem(profileKey, JSON.stringify(profile)); } catch { /* local preview can continue without persistence */ }
  }, [ownerId, profile, profileKey, storageOwner]);

  const handleUnauthorized = useCallback(async (error: unknown) => {
    if (error instanceof ApiError && error.status === 401) await refresh();
  }, [refresh]);

  const reloadProjects = useCallback(async () => {
    if (!user) {
      setProjects([]);
      setProjectsError(null);
      setProjectsLoading(false);
      setLoadedProjectsOwner(null);
      return;
    }

    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const result = await projectService.list();
      setProjects(result.projects.map(toAppProject));
    } catch (error) {
      setProjectsError(projectLoadMessage(error));
      await handleUnauthorized(error);
    } finally {
      setProjectsLoading(false);
      setLoadedProjectsOwner(user.id);
    }
  }, [handleUnauthorized, user]);

  useEffect(() => {
    void reloadProjects();
  }, [reloadProjects]);

  const getProject = useCallback(async (id: string) => {
    try {
      const result = await projectService.get(id);
      const project = toAppProject(result.project);
      setProjects(current => [project, ...current.filter(item => item.id !== project.id)]);
      return project;
    } catch (error) {
      await handleUnauthorized(error);
      throw error;
    }
  }, [handleUnauthorized]);

  const createProject = useCallback(async (input: NewProjectInput) => {
    try {
      const result = await projectService.create({
        title: input.title?.trim() || makeTitle(input.description),
        description: input.description.trim() || undefined,
      });
      const project = toAppProject(result.project);
      setProjects(current => [project, ...current.filter(item => item.id !== project.id)]);
      return project;
    } catch (error) {
      await handleUnauthorized(error);
      throw error;
    }
  }, [handleUnauthorized]);

  const uploadProjectMedia = useCallback(async (projectId: string, file: File) => {
    try {
      const result = await projectService.uploadMedia(projectId, file);
      return result.media;
    } catch (error) {
      await handleUnauthorized(error);
      throw error;
    }
  }, [handleUnauthorized]);

  function updateContent(projectId: string, channel: ContentChannel, value: string) {
    setProjects(current => current.map(project => project.id === projectId
      ? { ...project, content: { ...project.content, [channel]: value } }
      : project));
  }

  function updateProfile(nextProfile: LocalProfile) {
    setProfile(nextProfile);
  }

  const value = useMemo(() => ({
    projects,
    projectsLoading: projectsLoading || Boolean(user && loadedProjectsOwner !== user.id),
    projectsError,
    profile,
    reloadProjects,
    getProject,
    createProject,
    uploadProjectMedia,
    updateContent,
    updateProfile,
  }), [createProject, getProject, loadedProjectsOwner, profile, projects, projectsError, projectsLoading, reloadProjects, uploadProjectMedia, user]);
  return <UserAreaContext.Provider value={value}>{children}</UserAreaContext.Provider>;
}

export function useUserArea() {
  const context = useContext(UserAreaContext);
  if (!context) throw new Error('useUserArea must be used inside UserAreaProvider');
  return context;
}
