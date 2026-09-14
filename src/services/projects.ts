import { apiRequest } from '../lib/api';
import type { Project } from '../types/models';

export const projectService = {
  list: () => apiRequest<{ projects: Project[] }>('/projects'),
  get: (id: string) => apiRequest<{ project: Project }>(`/projects/${id}`),
  create: (payload: Partial<Project>) => apiRequest<{ project: Project }>('/projects', { method: 'POST', body: JSON.stringify(payload) })
};
