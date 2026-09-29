import { apiRequest } from '../lib/api';
import { appConfig } from '../config/app';

export type PlanCode = 'trial' | 'business';

export type PlanEntitlements = {
  plan: PlanCode;
  displayName: 'Testzugang' | 'Business';
  status: 'active' | 'pending' | 'expired';
  voice: {
    enabled: boolean;
    maxWords: number | null;
  };
  expiresAt: string | null;
  source: 'backend' | 'preview-default';
};

export const previewTrialEntitlements: PlanEntitlements = {
  plan: 'trial',
  displayName: 'Testzugang',
  status: 'active',
  voice: {
    enabled: appConfig.features.voice,
    maxWords: 15,
  },
  expiresAt: null,
  source: 'preview-default',
};

type BackendEntitlementsResponse = {
  ok: true;
  plan: PlanCode;
  displayName?: 'Testzugang' | 'Business';
  status?: 'active' | 'pending' | 'expired';
  voice?: {
    enabled?: boolean;
    maxWords?: number | null;
  };
  expiresAt?: string | null;
};

function normalize(result: BackendEntitlementsResponse): PlanEntitlements {
  const plan = result.plan === 'business' ? 'business' : 'trial';
  const displayName = plan === 'business' ? 'Business' : 'Testzugang';

  return {
    plan,
    displayName: result.displayName === displayName ? result.displayName : displayName,
    status: result.status || 'active',
    voice: {
      enabled: result.voice?.enabled === true,
      maxWords: typeof result.voice?.maxWords === 'number' ? result.voice.maxWords : null,
    },
    expiresAt: result.expiresAt || null,
    source: 'backend',
  };
}

export const entitlementsService = {
  getCurrent: async () => normalize(await apiRequest<BackendEntitlementsResponse>('/account/entitlements')),
};
