import type { Env } from './env';

export type PlanCode = 'trial' | 'business';

export type EntitlementsResponse = {
  ok: true;
  plan: PlanCode;
  displayName: 'Testzugang' | 'Business';
  status: 'active';
  voice: {
    enabled: true;
    maxWords: number | null;
  };
  features: {
    contentGeneration: true;
    share: boolean;
    businessIntegrations: boolean;
  };
  expiresAt: null;
};

type EntitlementRow = {
  plan: PlanCode;
};

export function isPlanCode(value: unknown): value is PlanCode {
  return value === 'trial' || value === 'business';
}

export function buildEntitlements(plan: PlanCode): EntitlementsResponse {
  if (plan === 'business') {
    return {
      ok: true,
      plan: 'business',
      displayName: 'Business',
      status: 'active',
      voice: {
        enabled: true,
        maxWords: null,
      },
      features: {
        contentGeneration: true,
        share: true,
        businessIntegrations: true,
      },
      expiresAt: null,
    };
  }

  return {
    ok: true,
    plan: 'trial',
    displayName: 'Testzugang',
    status: 'active',
    voice: {
      enabled: true,
      maxWords: 10,
    },
    features: {
      contentGeneration: true,
      share: false,
      businessIntegrations: false,
    },
    expiresAt: null,
  };
}

export async function getUserPlan(env: Env, userId: string): Promise<PlanCode> {
  const row = await env.DB.prepare('SELECT plan FROM users WHERE id = ?1 LIMIT 1')
    .bind(userId).first<EntitlementRow>();
  return row && isPlanCode(row.plan) ? row.plan : 'trial';
}
