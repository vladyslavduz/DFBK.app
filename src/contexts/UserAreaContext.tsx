import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';

export type AppProjectStatus = 'Entwurf' | 'Content erstellt' | 'Fertig';
export type ContentChannel = 'google' | 'social' | 'website';

export type ProjectContent = Record<ContentChannel, string>;

export type AppProject = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
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
  image: string;
};

type UserAreaContextValue = {
  projects: AppProject[];
  profile: LocalProfile;
  createProject: (input: NewProjectInput) => AppProject;
  updateContent: (projectId: string, channel: ContentChannel, value: string) => void;
  updateProfile: (profile: LocalProfile) => void;
};

const PROJECTS_KEY = 'dfbk.user-area.projects.v1';
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

export function UserAreaProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const ownerId = user?.id || 'guest';
  const projectsKey = `${PROJECTS_KEY}.${ownerId}`;
  const profileKey = `${PROFILE_KEY}.${ownerId}`;
  const [storageOwner, setStorageOwner] = useState(ownerId);
  const [projects, setProjects] = useState<AppProject[]>(() => readStorage(projectsKey, []));
  const [profile, setProfile] = useState<LocalProfile>(() => readStorage(profileKey, { name: '', company: '' }));

  useEffect(() => {
    if (storageOwner === ownerId) return;
    setProjects(readStorage(`${PROJECTS_KEY}.${ownerId}`, []));
    setProfile(readStorage(`${PROFILE_KEY}.${ownerId}`, { name: '', company: '' }));
    setStorageOwner(ownerId);
  }, [ownerId, storageOwner]);

  useEffect(() => {
    if (storageOwner !== ownerId) return;
    try { window.localStorage.setItem(projectsKey, JSON.stringify(projects)); } catch { /* local preview can continue without persistence */ }
  }, [ownerId, projects, projectsKey, storageOwner]);

  useEffect(() => {
    if (storageOwner !== ownerId) return;
    try { window.localStorage.setItem(profileKey, JSON.stringify(profile)); } catch { /* local preview can continue without persistence */ }
  }, [ownerId, profile, profileKey, storageOwner]);

  function createProject(input: NewProjectInput) {
    const project: AppProject = {
      id: crypto.randomUUID(),
      title: input.title?.trim() || makeTitle(input.description),
      description: input.description.trim(),
      createdAt: new Date().toISOString(),
      status: 'Content erstellt',
      originalImage: input.image || FALLBACK_IMAGE,
      optimizedImage: input.image || FALLBACK_IMAGE,
      content: makeContent(input.description),
    };
    setProjects(current => [project, ...current]);
    return project;
  }

  function updateContent(projectId: string, channel: ContentChannel, value: string) {
    setProjects(current => current.map(project => project.id === projectId
      ? { ...project, content: { ...project.content, [channel]: value } }
      : project));
  }

  function updateProfile(nextProfile: LocalProfile) {
    setProfile(nextProfile);
  }

  const value = useMemo(() => ({ projects, profile, createProject, updateContent, updateProfile }), [profile, projects]);
  return <UserAreaContext.Provider value={value}>{children}</UserAreaContext.Provider>;
}

export function useUserArea() {
  const context = useContext(UserAreaContext);
  if (!context) throw new Error('useUserArea must be used inside UserAreaProvider');
  return context;
}
