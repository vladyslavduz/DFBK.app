import { accept, reject, validInstant, validateScheduleTime, validateSnapshot, assessAdmission, approvalIdentity, executionKey,
  validatePolicy, type Policy, type Result, type Snapshot, type ScheduleTime } from './scheduler-contract';

export type Status = 'scheduled' | 'running' | 'published' | 'failed' | 'unknown' | 'reconnect_required' | 'cancelled';
export type Model = {
  id: string; version: number; status: Status; snapshot: Snapshot; time: ScheduleTime;
  approval: { version: number; identity: string; at: number; policy: Policy } | null;
  executionKey: string; attempts: number;
  lease: { token: string; expiresAt: number } | null;
  usedLeaseTokens: string[];
  lastTransitionAt: number | null;
  checkpointAt: number | null;
  evidence: { outcome: 'published'; postId: string; observedAt: number }
    | { outcome: 'not_published'; reference: string; observedAt: number } | null;
};
type Checks = { policy: unknown; gates: unknown };
type Fence = { token: string };
export type Action =
  | ({ type: 'approve'; identity: string } & Checks)
  | { type: 'edit'; snapshot: unknown; time: unknown }
  | { type: 'cancel' }
  | ({ type: 'claim'; token: string; leaseExpiresAt: number } & Checks)
  | ({ type: 'checkpoint' } & Fence & Checks)
  | ({ type: 'published'; postId: string } & Fence)
  | ({ type: 'uncertain' } & Fence)
  | ({ type: 'blocked'; reason: 'failed' | 'reconnect_required' } & Fence)
  | { type: 'expire' }
  | { type: 'reconcile'; evidence: { outcome: 'published'; postId: string } | { outcome: 'not_published'; reference: string } };

export function createSchedule(id: string, snapshot: unknown, time: unknown): Result<Model> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) return reject('INVALID_SCHEDULE_ID');
  const material = validateSnapshot(snapshot);
  if (!material.ok) return material;
  const instant = validateScheduleTime(time);
  if (!instant.ok) return instant;
  return accept({ id, version: 1, status: 'scheduled', snapshot: material.value, time: instant.value,
    approval: null, executionKey: executionKey(id, 1), attempts: 0, lease: null, usedLeaseTokens: [], lastTransitionAt: null, checkpointAt: null, evidence: null });
}

/** Pure transition model, NOT a DB lock or provider evidence verifier.
 * Persistence must perform atomic CAS and independently authenticate reconciliation evidence.
 * All clocks, policy, permission checks and lease deadlines are supplied by the caller.
 */
export function transition(state: Model, expectedVersion: number, action: Action, now: number): Result<Model> {
  if (!validInstant(now)) return reject('INVALID_CLOCK');
  if (state.lastTransitionAt !== null && now < state.lastTransitionAt) return reject('CLOCK_REGRESSION');
  if (expectedVersion !== state.version) return reject('VERSION_CONFLICT');
  const next = structuredClone(state);
  next.lastTransitionAt = now;
  const approved = state.approval?.version === state.version && state.approval.identity === approvalIdentity(state.snapshot, state.time);
  const fenced = (token: string) => state.status === 'running' && state.lease?.token === token && state.lease.expiresAt > now;
  const samePolicy = (input: unknown) => {
    const checked = validatePolicy(input);
    return checked.ok && state.approval !== null && JSON.stringify(checked.value) === JSON.stringify(state.approval.policy);
  };
  switch (action.type) {
    case 'edit': {
      if (state.status !== 'scheduled' || state.attempts !== 0) return reject('EDIT_CONFLICT');
      const replacement = createSchedule(state.id, action.snapshot, action.time);
      if (!replacement.ok) return replacement;
      if (!Number.isSafeInteger(state.version + 1)) return reject('VERSION_EXHAUSTED');
      next.snapshot = replacement.value.snapshot;
      next.time = replacement.value.time;
      next.version++;
      next.executionKey = executionKey(state.id, next.version);
      next.approval = null;
      return accept(next);
    }
    case 'approve': {
      if (state.status !== 'scheduled' || state.attempts !== 0) return reject('APPROVAL_CONFLICT');
      if (action.identity !== approvalIdentity(state.snapshot, state.time)) return reject('APPROVAL_SNAPSHOT_MISMATCH');
      const admitted = assessAdmission(state.snapshot, state.time, now, action.policy, action.gates, 'plan', state.attempts);
      if (!admitted.ok) return admitted;
      next.approval = { version: state.version, identity: action.identity, at: now, policy: admitted.value };
      return accept(next);
    }
    case 'cancel':
      if (state.status !== 'scheduled' || state.attempts !== 0) return reject('CANCEL_CONFLICT');
      next.status = 'cancelled';
      next.approval = null;
      if (!Number.isSafeInteger(state.version + 1)) return reject('VERSION_EXHAUSTED');
      next.version++;
      next.executionKey = executionKey(state.id, next.version);
      return accept(next);
    case 'claim': {
      if (state.status !== 'scheduled' || !approved || state.checkpointAt !== null) return reject('CLAIM_CONFLICT');
      if (!samePolicy(action.policy)) return reject('APPROVED_POLICY_REQUIRED');
      if (!/^[A-Za-z0-9_-]{16,128}$/.test(action.token) || !validInstant(action.leaseExpiresAt) || action.leaseExpiresAt <= now) return reject('INVALID_LEASE');
      if (state.usedLeaseTokens.includes(action.token)) return reject('LEASE_TOKEN_REUSED');
      const admitted = assessAdmission(state.snapshot, state.time, now, action.policy, action.gates, 'dispatch', state.attempts);
      if (!admitted.ok) return admitted;
      next.status = 'running';
      next.attempts++;
      next.lease = { token: action.token, expiresAt: action.leaseExpiresAt };
      next.usedLeaseTokens.push(action.token);
      return accept(next);
    }
    case 'checkpoint': {
      if (!fenced(action.token) || !approved) return reject('FENCE_CONFLICT');
      if (state.checkpointAt !== null) return reject('CHECKPOINT_ALREADY_SET');
      if (!samePolicy(action.policy)) return reject('APPROVED_POLICY_REQUIRED');
      const admitted = assessAdmission(state.snapshot, state.time, now, action.policy, action.gates, 'dispatch', state.attempts - 1);
      if (!admitted.ok) return admitted;
      next.checkpointAt = now;
      return accept(next);
    }
    case 'published':
      if (!fenced(action.token) || state.checkpointAt === null) return reject('FENCE_OR_CHECKPOINT_CONFLICT');
      if (typeof action.postId !== 'string' || !action.postId.trim() || /[\u0000-\u001f\u007f]/u.test(action.postId)) return reject('INVALID_EVIDENCE');
      next.status = 'published';
      next.evidence = { outcome: 'published', postId: action.postId, observedAt: now };
      next.lease = null;
      return accept(next);
    case 'uncertain':
      if (!fenced(action.token) || state.checkpointAt === null) return reject('FENCE_OR_CHECKPOINT_CONFLICT');
      next.status = 'unknown';
      next.lease = null;
      return accept(next);
    case 'blocked':
      if (!fenced(action.token) || state.checkpointAt !== null) return reject('FENCE_OR_CHECKPOINT_CONFLICT');
      if (action.reason !== 'failed' && action.reason !== 'reconnect_required') return reject('INVALID_BLOCK_REASON');
      next.status = action.reason;
      next.lease = null;
      return accept(next);
    case 'expire':
      if (state.status !== 'running' || !state.lease || state.lease.expiresAt > now) return reject('LEASE_NOT_EXPIRED');
      next.status = state.checkpointAt === null ? 'scheduled' : 'unknown';
      next.lease = null;
      return accept(next);
    case 'reconcile':
      if (state.status !== 'unknown' || state.checkpointAt === null) return reject('RECONCILIATION_CONFLICT');
      if (action.evidence.outcome === 'published') {
        if (typeof action.evidence.postId !== 'string' || !action.evidence.postId.trim() || /[\u0000-\u001f\u007f]/u.test(action.evidence.postId)) return reject('INVALID_EVIDENCE');
        next.status = 'published';
        next.evidence = { outcome: 'published', postId: action.evidence.postId, observedAt: now };
      } else {
        if (action.evidence.outcome !== 'not_published' || typeof action.evidence.reference !== 'string' || !action.evidence.reference.trim() || /[\u0000-\u001f\u007f]/u.test(action.evidence.reference)) return reject('INVALID_EVIDENCE');
        // Even proven non-publication does not silently re-admit the approved operation.
        next.status = 'failed';
        next.evidence = { outcome: 'not_published', reference: action.evidence.reference, observedAt: now };
      }
      return accept(next);
    default: return reject('INVALID_ACTION');
  }
}
