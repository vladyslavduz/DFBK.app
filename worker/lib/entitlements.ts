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

export async function getUserPlan(
  env: Env,
  userId: string
): Promise<PlanCode> {
  const row = await env.DB
    .prepare(
      `
      SELECT plan
      FROM user_entitlements
      WHERE user_id = ?1
      LIMIT 1
      `
    )
    .bind(userId)
    .first<EntitlementRow>();

  if (!row || !isPlanCode(row.plan)) {
    return 'trial';
  }

  return row.plan;
}

export async function setUserPlan(
  env: Env,
  userId: string,
  plan: PlanCode
): Promise<void> {
  if (plan === 'trial') {
    await env.DB
      .prepare(
        `
        DELETE FROM user_entitlements
        WHERE user_id = ?1
        `
      )
      .bind(userId)
      .run();
    return;
  }

  await env.DB
    .prepare(
      `
      INSERT INTO user_entitlements (
        user_id,
        plan
      )
      VALUES (?1, 'business')
      ON CONFLICT(user_id)
      DO UPDATE SET
        plan = 'business',
        updated_at = CURRENT_TIMESTAMP
      `
    )
    .bind(userId)
    .run();
}
