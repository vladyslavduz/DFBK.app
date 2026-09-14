import { apiRequest } from '../lib/api';

export const aiService = {
  analyzePhoto: (projectId: string) => apiRequest('/ai/analyze-photo', { method: 'POST', body: JSON.stringify({ projectId }) }),
  generateContent: (projectId: string) => apiRequest('/ai/generate-content', { method: 'POST', body: JSON.stringify({ projectId }) })
};
