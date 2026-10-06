import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { ApiError } from '../lib/api';
import { getProjectMediaUrl, projectService } from '../services/projects';
import { entitlementsService, fallbackTrialEntitlements, type PlanEntitlements } from '../services/entitlements';
import type {
  MediaAsset,
  Project,
  ProjectGeneratedContent,
  ProjectMedia,
  ProjectMediaResponse,
  ProjectPhotoOptimization,
  ProjectStatus,
  ProjectTitleSource,
} from '../types/models';

export type ContentChannel = 'google' | 'social' | 'website';
export type ProjectContent = Record<ContentChannel, string>;

export type AppProject = {
  id: string;
  title: string;
  titleSource: ProjectTitleSource;
  description: string;
  createdAt: string;
  updatedAt: string;
  status: ProjectStatus;
  photoOptimization: ProjectPhotoOptimization;
  media: ProjectMedia;
  originalImage: string | null;
  optimizedImage: string | null;
  content: ProjectContent | null;
};

export type LocalProfile = { name: string; company: string };

type NewProjectInput = { description: string };

type UserAreaContextValue = {
  projects: AppProject[];
  projectsLoading: boolean;
  projectsError: string | null;
  profile: LocalProfile;
  plan: PlanEntitlements;
  planLoading: boolean;
  planError: string | null;
  reloadPlan: () => Promise<void>;
  reloadProjects: () => Promise<void>;
  getProject: (id: string) => Promise<AppProject>;
  getProjectMedia: (id: string) => Promise<ProjectMediaResponse>;
  optimizeProjectImage: (id: string) => Promise<ProjectMediaResponse>;
  getProjectContent: (id: string) => Promise<ProjectContent | null>;
  generateProjectContent: (id: string) => Promise<{ project: AppProject; content: ProjectContent }>;
  createProject: (input: NewProjectInput) => Promise<AppProject>;
  renameProject: (id: string, title: string) => Promise<AppProject>;
  uploadProjectMedia: (projectId: string, file: File) => Promise<MediaAsset>;
  updateContent: (projectId: string, channel: ContentChannel, value: string) => void;
  updateProfile: (profile: LocalProfile) => void;
};

const PROFILE_KEY = 'dfbk.user-area.profile.v1';
const UserAreaContext = createContext<UserAreaContextValue | null>(null);

function readStorage<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function toProjectContent(content: ProjectGeneratedContent | null): ProjectContent | null {
  if (!content || typeof content.googleBusiness !== 'string' || typeof content.socialMedia !== 'string' || typeof content.websiteReference !== 'string') return null;
  return { google: content.googleBusiness, social: content.socialMedia, website: content.websiteReference };
}

function mediaImages(projectId: string, media: ProjectMedia) {
  return {
    originalImage: media.original ? getProjectMediaUrl(projectId, media.original.id) : null,
    optimizedImage: media.optimized ? getProjectMediaUrl(projectId, media.optimized.id) : null,
  };
}

function toAppProject(project: Project): AppProject {
  const media: ProjectMedia = { original: project.media, optimized: null };
  return {
    id: project.id,
    title: project.title,
    titleSource: project.titleSource,
    description: project.description || '',
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    status: project.status,
    photoOptimization: project.photoOptimization,
    media,
    ...mediaImages(project.id, media),
    content: null,
  };
}

function mergeServerProject(project: Project, current?: AppProject | null, content?: ProjectContent | null): AppProject {
  const base = toAppProject(project);
  if (!current) return { ...base, content: content ?? null };
  const media: ProjectMedia = {
    original: base.media.original ?? current.media.original,
    optimized: current.media.optimized,
  };
  return {
    ...base,
    media,
    ...mediaImages(project.id, media),
    content: content !== undefined ? content : current.content,
  };
}

export function projectStatusLabel(status: ProjectStatus) {
  if (status === 'draft') return 'Entwurf';
  if (status === 'processing') return 'Wird erstellt…';
  if (status === 'ready') return 'Bereit';
  if (status === 'finished') return 'Abgeschlossen';
  return 'Erstellung fehlgeschlagen';
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
  const [plan, setPlan] = useState<PlanEntitlements>(fallbackTrialEntitlements);
  const [planOwnerId, setPlanOwnerId] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const planRequestId = useRef(0);

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

  const reloadPlan = useCallback(async () => {
    const requestId = ++planRequestId.current;
    setPlan(fallbackTrialEntitlements);
    setPlanOwnerId(user?.id || null);
    if (!user) {
      setPlanError(null);
      setPlanLoading(false);
      return;
    }
    setPlanLoading(true);
    setPlanError(null);
    try {
      const nextPlan = await entitlementsService.getCurrent();
      if (requestId === planRequestId.current) setPlan(nextPlan);
    } catch (error) {
      if (requestId !== planRequestId.current) return;
      setPlanError('Tarif konnte nicht geladen werden. Bitte aktualisiere den Status.');
      await handleUnauthorized(error);
    } finally {
      if (requestId === planRequestId.current) setPlanLoading(false);
    }
  }, [handleUnauthorized, user]);

  useEffect(() => { void reloadProjects(); }, [reloadProjects]);
  useEffect(() => { void reloadPlan(); }, [reloadPlan]);

  useEffect(() => {
    if (!user) return;
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void reloadPlan();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [reloadPlan, user]);

  const getProject = useCallback(async (id: string) => {
    try {
      const result = await projectService.get(id);
      let resolved = toAppProject(result.project);
      setProjects(current => {
        const existing = current.find(item => item.id === id);
        resolved = mergeServerProject(result.project, existing);
        return [resolved, ...current.filter(item => item.id !== id)];
      });
      return resolved;
    } catch (error) {
      await handleUnauthorized(error);
      throw error;
    }
  }, [handleUnauthorized]);

  const getProjectMedia = useCallback(async (id: string) => {
    try {
      const result = await projectService.getProjectMedia(id);
      setProjects(current => current.map(project => project.id === id
        ? {
            ...project,
            media: result.media,
            photoOptimization: result.photoOptimization,
            ...mediaImages(id, result.media),
          }
        : project));
      return result;
    } catch (error) {
      await handleUnauthorized(error);
      throw error;
    }
  }, [handleUnauthorized]);

  const optimizeProjectImage = useCallback(async (id: string) => {
    try {
      await projectService.optimizeProjectImage(id);
      return await getProjectMedia(id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409 && ['PHOTO_OPTIMIZATION_IN_PROGRESS', 'PHOTO_ALREADY_OPTIMIZED'].includes(error.code)) {
        return await getProjectMedia(id);
      }
      await handleUnauthorized(error);
      throw error;
    }
  }, [getProjectMedia, handleUnauthorized]);

  const createProject = useCallback(async (input: NewProjectInput) => {
    try {
      const result = await projectService.create({
        description: input.description.trim() || undefined,
      });
      const project = toAppProject(result.project);
      setProjects(current => [project, ...current.filter(item => item.id !== project.id)]);
      await reloadPlan();
      return project;
    } catch (error) {
      if (error instanceof ApiError && error.code === 'TRIAL_PROJECT_LIMIT_REACHED') await reloadPlan();
      await handleUnauthorized(error);
      throw error;
    }
  }, [handleUnauthorized, reloadPlan]);

  const renameProject = useCallback(async (id: string, title: string) => {
    try {
      const result = await projectService.rename(id, title);
      let resolved = toAppProject(result.project);
      setProjects(current => current.map(project => {
        if (project.id !== id) return project;
        resolved = mergeServerProject(result.project, project);
        return resolved;
      }));
      return resolved;
    } catch (error) {
      await handleUnauthorized(error);
      throw error;
    }
  }, [handleUnauthorized]);

  const getProjectContent = useCallback(async (id: string) => {
    try {
      const result = await projectService.getProjectContent(id);
      const content = toProjectContent(result.content);
      setProjects(current => current.map(project => project.id === id ? { ...project, content } : project));
      return content;
    } catch (error) {
      await handleUnauthorized(error);
      throw error;
    }
  }, [handleUnauthorized]);

  const generateProjectContent = useCallback(async (id: string) => {
    try {
      const result = await projectService.generateProjectContent(id);
      const content = toProjectContent(result.content);
      if (!content) throw new ApiError(500, 'PROJECT_CONTENT_UNAVAILABLE');
      let resolved = toAppProject(result.project);
      setProjects(current => current.map(project => {
        if (project.id !== id) return project;
        resolved = mergeServerProject(result.project, project, content);
        return resolved;
      }));
      return { project: resolved, content };
    } catch (error) {
      await handleUnauthorized(error);
      throw error;
    }
  }, [handleUnauthorized]);

  const uploadProjectMedia = useCallback(async (projectId: string, file: File) => {
    try {
      const result = await projectService.uploadMedia(projectId, file);
      const original = { id: result.media.id, mimeType: result.media.mimeType };
      setProjects(current => current.map(project => project.id === projectId
        ? {
            ...project,
            media: { original, optimized: null },
            originalImage: getProjectMediaUrl(projectId, original.id),
            optimizedImage: null,
          }
        : project));
      return result.media;
    } catch (error) {
      await handleUnauthorized(error);
      throw error;
    }
  }, [handleUnauthorized]);

  function updateContent(projectId: string, channel: ContentChannel, value: string) {
    setProjects(current => current.map(project => project.id === projectId
      ? project.content ? { ...project, content: { ...project.content, [channel]: value } } : project
      : project));
  }

  function updateProfile(nextProfile: LocalProfile) { setProfile(nextProfile); }

  const value = useMemo(() => ({
    projects,
    projectsLoading: projectsLoading || Boolean(user && loadedProjectsOwner !== user.id),
    projectsError,
    profile,
    plan: planOwnerId === (user?.id || null) ? plan : fallbackTrialEntitlements,
    planLoading: planLoading || Boolean(user && planOwnerId !== user.id),
    planError,
    reloadPlan,
    reloadProjects,
    getProject,
    getProjectMedia,
    optimizeProjectImage,
    getProjectContent,
    generateProjectContent,
    createProject,
    renameProject,
    uploadProjectMedia,
    updateContent,
    updateProfile,
  }), [createProject, generateProjectContent, getProject, getProjectContent, getProjectMedia, loadedProjectsOwner, optimizeProjectImage, plan, planError, planLoading, planOwnerId, profile, projects, projectsError, projectsLoading, reloadPlan, reloadProjects, renameProject, uploadProjectMedia, user]);

  return <UserAreaContext.Provider value={value}>{children}</UserAreaContext.Provider>;
}

export function useUserArea() {
  const context = useContext(UserAreaContext);
  if (!context) throw new Error('useUserArea must be used inside UserAreaProvider');
  return context;
}
