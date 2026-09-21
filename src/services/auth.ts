import { apiRequest } from '../lib/api';
import { appConfig } from '../config/app';

export type AuthUser = {
  id: string;
  email: string;
  emailVerified: boolean;
};

export type AuthResult = { ok: true; user: AuthUser };
export type RegisterResult = AuthResult & { verificationEmailSent: boolean };

export const authService = {
  login: (email: string, password: string) => apiRequest<AuthResult>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (payload: Record<string, unknown>) => apiRequest<RegisterResult>('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  me: () => apiRequest<AuthResult & { session: { expiresAt: string } }>('/auth/me'),
  forgotPassword: (email: string) => apiRequest('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  logout: () => apiRequest<{ ok: true }>('/auth/logout', { method: 'POST' }),
  googleStartUrl: () => `${appConfig.apiBaseUrl}/auth/google`,
};
