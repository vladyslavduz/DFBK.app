import { apiRequest } from '../lib/api';

export const authService = {
  login: (email: string, password: string) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (payload: Record<string, unknown>) => apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  forgotPassword: (email: string) => apiRequest('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  logout: () => apiRequest('/auth/logout', { method: 'POST' })
};
