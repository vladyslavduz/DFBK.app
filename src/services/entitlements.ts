import { apiRequest } from '../lib/api';

export type PlanCode = 'trial' | 'business';
export const TRIAL_VOICE_MAX_WORDS = 10;

export type PlanEntitlements = {
  plan: PlanCode;
  displayName: 'Testzugang' | 'Business';
  status: 'active' | 'pending' | 'expired';
  voice: {
    enabled: boolean;
    maxWords: number | null;
  };
  features: {
    contentGeneration: boolean;
    share: boolean;
    businessIntegrations: boolean;
  };
  expiresAt: string | null;
  source: 'backend' | 'fallback';
};

export const fallbackTrialEntitlements: PlanEntitlements = {
  plan: 'trial',
  displayName: 'Testzugang',
  status: 'active',
  voice: {
    enabled: true,
    maxWords: TRIAL_VOICE_MAX_WORDS,
  },
  features: {
    contentGeneration: true,
    share: false,
    businessIntegrations: false,
  },
  expiresAt: null,
  source: 'fallback',
};

type BackendEntitlementsResponse = {
  ok: true;
  plan: unknown;
  displayName?: unknown;
  status?: unknown;
  voice?: {
    enabled?: unknown;
    maxWords?: unknown;
  };
  features?: {
    contentGeneration?: unknown;
    share?: unknown;
    businessIntegrations?: unknown;
  };
  expiresAt?: unknown;
};

export function normalizeEntitlements(result: BackendEntitlementsResponse): PlanEntitlements {
  const business = result?.ok === true && result.plan === 'business';
  const trial = result?.ok === true && result.plan === 'trial';
  const expectedName = business ? 'Business' : 'Testzugang';
  const voice = result?.voice;
  const features = result?.features;

  // Only a complete, active backend response can grant plan features.
  if (
    (!trial && !business) || result.status !== 'active' ||
    result.displayName !== expectedName || voice?.enabled !== true ||
    voice.maxWords !== (business ? null : TRIAL_VOICE_MAX_WORDS) ||
    features?.contentGeneration !== true || features.share !== true ||
    features.businessIntegrations !== business || result.expiresAt !== null
  ) throw new Error('INVALID_ENTITLEMENTS_RESPONSE');

  return {
    plan: business ? 'business' : 'trial',
    displayName: expectedName,
    status: 'active',
    voice: {
      enabled: true,
      maxWords: business ? null : TRIAL_VOICE_MAX_WORDS,
    },
    features: {
      contentGeneration: true,
      share: true,
      businessIntegrations: business,
    },
    expiresAt: null,
    source: 'backend',
  };
}

export const entitlementsService = {
  getCurrent: async () => normalizeEntitlements(await apiRequest<BackendEntitlementsResponse>('/account/entitlements')),
};
