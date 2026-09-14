import { apiRequest } from '../lib/api';

export const profileService = {
  get: () => apiRequest('/profile'),
  update: (payload: Record<string, unknown>) => apiRequest('/profile', { method: 'PUT', body: JSON.stringify(payload) })
};
