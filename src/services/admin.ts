import { ApiError, apiRequest } from '../lib/api';

export type AdminRole = 'user' | 'admin';
export type AdminPlan = 'trial' | 'business';
export type AdminPlanSource = 'system' | 'manual_admin' | 'stripe';

export type AdminIdentity = {
  id: string;
  email: string;
  role: 'admin';
};

export type AdminUser = {
  id: string;
  email: string;
  role: AdminRole;
  plan: AdminPlan;
  planSource: AdminPlanSource;
  trialExpiresAt: string | null;
  planUpdatedAt: string | null;
  createdAt: string;
};

export type AdminPlanMutation = {
  changed: boolean;
  user: AdminUser;
};

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

function isAdminUser(value: unknown): value is AdminUser {
  if (!value || typeof value !== 'object') return false;
  const user = value as Record<string, unknown>;
  return (
    isString(user.id) &&
    isString(user.email) &&
    (user.role === 'user' || user.role === 'admin') &&
    (user.plan === 'trial' || user.plan === 'business') &&
    (user.planSource === 'system' || user.planSource === 'manual_admin' || user.planSource === 'stripe') &&
    isNullableString(user.trialExpiresAt) &&
    isNullableString(user.planUpdatedAt) &&
    isString(user.createdAt)
  );
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export const adminService = {
  me: async (): Promise<AdminIdentity> => {
    const result = await apiRequest<unknown>('/admin/me');
    if (!result || typeof result !== 'object') throw new ApiError(500, 'INVALID_ADMIN_RESPONSE');
    const data = result as Record<string, unknown>;
    if (!isString(data.id) || !isString(data.email) || data.role !== 'admin') {
      throw new ApiError(500, 'INVALID_ADMIN_RESPONSE');
    }
    return { id: data.id, email: data.email, role: 'admin' };
  },

  findUserByEmail: async (email: string): Promise<AdminUser> => {
    const normalized = normalizeEmail(email);
    const result = await apiRequest<unknown>(`/admin/users?email=${encodeURIComponent(normalized)}`);
    if (!result || typeof result !== 'object' || !isAdminUser((result as Record<string, unknown>).user)) {
      throw new ApiError(500, 'INVALID_ADMIN_USER_RESPONSE');
    }
    return (result as { user: AdminUser }).user;
  },

  changePlan: async (userId: string, plan: AdminPlan): Promise<AdminPlanMutation> => {
    const result = await apiRequest<unknown>(`/admin/users/${encodeURIComponent(userId)}/plan`, {
      method: 'PATCH',
      body: JSON.stringify({ plan }),
    });
    if (!result || typeof result !== 'object') throw new ApiError(500, 'INVALID_ADMIN_MUTATION_RESPONSE');
    const data = result as Record<string, unknown>;
    if (typeof data.changed !== 'boolean' || !isAdminUser(data.user)) {
      throw new ApiError(500, 'INVALID_ADMIN_MUTATION_RESPONSE');
    }
    return { changed: data.changed, user: data.user };
  },
};
