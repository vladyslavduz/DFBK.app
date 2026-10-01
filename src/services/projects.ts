import { apiRequest } from '../lib/api';
import type {
  MediaAsset,
  Project,
  ProjectContentResponse,
  ProjectMediaResponse,
  ProjectOptimizeResponse,
} from '../types/models';

type CreateProjectInput = {
  title: string;
  description?: string;
};

export function getProjectMediaUrl(projectId: string, mediaId: string) {
  return `/api/projects/${encodeURIComponent(projectId)}/media/${encodeURIComponent(mediaId)}`;
}

export const projectService = {
  list: () => apiRequest<{ ok: true; projects: Project[] }>('/projects'),
  get: (id: string) => apiRequest<{ ok: true; project: Project }>(`/projects/${encodeURIComponent(id)}`),
  getProjectMedia: (projectId: string) => apiRequest<ProjectMediaResponse>(
    `/projects/${encodeURIComponent(projectId)}/media`,
  ),
  optimizeProjectImage: (projectId: string) => apiRequest<ProjectOptimizeResponse>(
    `/projects/${encodeURIComponent(projectId)}/optimize`,
    { method: 'POST' },
  ),
  getProjectContent: (projectId: string) => apiRequest<ProjectContentResponse>(
    `/projects/${encodeURIComponent(projectId)}/content`,
  ),
  generateProjectContent: (projectId: string) => apiRequest<ProjectContentResponse>(
    `/projects/${encodeURIComponent(projectId)}/generate`,
    { method: 'POST' },
  ),
  create: (payload: CreateProjectInput) => apiRequest<{ ok: true; project: Project }>('/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  uploadMedia: (projectId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);

    return apiRequest<{ ok: true; media: MediaAsset }>(`/projects/${encodeURIComponent(projectId)}/media`, {
      method: 'POST',
      body: form,
    });
  },
};
