import { isTrialActive } from './user';
import { TRIAL_PROJECT_LIMIT } from './project-management';

/** Approved PRODUCT_BASELINE target only. Not wired into runtime gates or enforcement. */
export const TRIAL_EXISTING_PROJECT_LIMIT = TRIAL_PROJECT_LIMIT;
export const TRIAL_SUCCESSFUL_SEND_LIMIT = 15;
export const TRIAL_SEND_SCOPE = 'trial_lifetime_successful_sends';
export type PublicationUsage = { scope: string; consumed: number; reserved: number };
/** Business scope/limit must be explicitly approved; no cadence or unlimited default. */
export type BusinessPublicationPolicy = { scope: string; limit: number };
export type PublicationEntitlementInput = {
  account: { plan: 'trial'; access: 'active' | 'blocked' | 'unknown'; trialExpiresAt: string | null }
    | { plan: 'business'; access: 'active' | 'blocked' | 'unknown' };
  usage: PublicationUsage;
  now: number;
  businessPolicy?: BusinessPublicationPolicy;
};
export type PublicationEntitlement = {
  status: 'available' | 'blocked' | 'not_configured';
  reason: 'capacity_available' | 'account_blocked' | 'account_unknown' | 'invalid_input' | 'trial_inactive'
    | 'trial_expiry_unknown' | 'business_policy_required' | 'invalid_business_policy' | 'invalid_usage' | 'budget_exhausted';
  cannotDispatch: true;
  /** Parity is an approved TARGET, not a claim a connector/runner or AI budget exists. */
  targetCapabilities: Readonly<{ channelSpecificText: boolean; publishNow: boolean; schedule: boolean }>;
  budget: Readonly<{ unit: 'successful_send_per_channel'; scope: string | null; limit: number | null;
    consumed: number | null; reserved: number | null; remaining: number | null }>;
};
const count = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const scope = (v: unknown): v is string => typeof v === 'string' && !!v && v.trim() === v && !/[\u0000-\u001f\u007f]/u.test(v);
function record(v: unknown, required: readonly string[] = []): Record<string, unknown> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v) || (Object.getPrototypeOf(v) !== Object.prototype && Object.getPrototypeOf(v) !== null)) return null;
  if (Reflect.ownKeys(v).some(k => typeof k !== 'string') || Object.values(Object.getOwnPropertyDescriptors(v)).some(p => !('value' in p) || !p.enumerable)) return null;
  if (required.some(key => !Object.hasOwn(v, key))) return null;
  return v as Record<string, unknown>;
}

/** Read-only arithmetic on a trusted ledger snapshot; no reserve/consume/release writes.
 * Future store must atomically reserve capacity and consume confirmed success ONCE per
 * exact destination/operation; errors/retries never consume twice, cancellation releases.
 * Unknown provider outcome is neither success nor automatic reserve release. Drafts do
 * not send or consume. Downgrade/expiry/reset policy is NOT inferred here. The caller must
 * supply current verified account access and counters for the exact scope, not draft counts
 * (100/24h), request rate (20/h), or generated-content counts. Those are separate budgets.
 */
export function evaluatePublicationEntitlement(input: unknown): PublicationEntitlement {
  let active = false, budgetScope: string | null = null, limit: number | null = null;
  const finish = (status: PublicationEntitlement['status'], reason: PublicationEntitlement['reason'], usage?: PublicationUsage): PublicationEntitlement => Object.freeze({
    status, reason, cannotDispatch: true,
    targetCapabilities: Object.freeze({ channelSpecificText: active, publishNow: active, schedule: active }),
    budget: Object.freeze({ unit: 'successful_send_per_channel', scope: budgetScope, limit,
      consumed: usage?.consumed ?? null, reserved: usage?.reserved ?? null,
      remaining: usage && limit !== null ? limit - usage.consumed - usage.reserved : null }),
  });
  const request = record(input, ['account', 'now']), account = request && record(request.account, ['plan', 'access']);
  if (!request || !account || typeof request.now !== 'number' || !Number.isSafeInteger(request.now) || !Number.isFinite(new Date(request.now).getTime()) ||
      (account.plan !== 'trial' && account.plan !== 'business')) return finish('not_configured', 'invalid_input');
  if (account.access === 'blocked') return finish('blocked', 'account_blocked');
  if (account.access !== 'active') return finish('not_configured', 'account_unknown');
  if (account.plan === 'trial') {
    if (!Object.hasOwn(account, 'trialExpiresAt') || (account.trialExpiresAt !== null && typeof account.trialExpiresAt !== 'string')) return finish('not_configured', 'trial_expiry_unknown');
    if (!isTrialActive({ plan: 'trial', trial_expires_at: account.trialExpiresAt }, request.now)) return finish('blocked', 'trial_inactive');
    budgetScope = TRIAL_SEND_SCOPE;
    limit = TRIAL_SUCCESSFUL_SEND_LIMIT;
  } else {
    // Capability parity is independent of an unconfigured send budget; this library
    // does not change existing Business access. Actual dispatch still fails closed.
    active = true;
    if (request.businessPolicy === undefined || request.businessPolicy === null) return finish('not_configured', 'business_policy_required');
    const policy = record(request.businessPolicy, ['scope', 'limit']);
    if (!policy || !scope(policy.scope) || policy.scope === TRIAL_SEND_SCOPE || !count(policy.limit)) return finish('not_configured', 'invalid_business_policy');
    budgetScope = policy.scope;
    limit = policy.limit;
  }
  active = true;
  const usage = record(request.usage, ['scope', 'consumed', 'reserved']);
  if (!usage || usage.scope !== budgetScope || !count(usage.consumed) || !count(usage.reserved) ||
      usage.consumed > limit || usage.reserved > limit - usage.consumed) return finish('blocked', 'invalid_usage');
  const validated = { scope: budgetScope, consumed: usage.consumed, reserved: usage.reserved };
  return finish(limit - usage.consumed - usage.reserved > 0 ? 'available' : 'blocked',
    limit - usage.consumed - usage.reserved > 0 ? 'capacity_available' : 'budget_exhausted', validated);
}
