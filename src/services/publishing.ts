import { apiRequest } from '../lib/api';
import type { Channel } from '../types/models';

export function publishProject(projectId: string, channel: Channel) {
  return apiRequest(`/publish/${channel}`, { method: 'POST', body: JSON.stringify({ projectId }) });
}
