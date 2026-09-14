import { apiRequest } from '../lib/api';

export const integrationService = {
  status: () => apiRequest('/integrations/status'),
  connectGoogle: () => apiRequest('/integrations/google/start', { method: 'POST' }),
  connectMeta: () => apiRequest('/integrations/meta/start', { method: 'POST' }),
  connectTelegram: (payload: Record<string, unknown>) => apiRequest('/integrations/telegram/connect', { method: 'POST', body: JSON.stringify(payload) })
};
