import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

// Compile only these pure modules in memory using the repository's existing TypeScript.
// No Vite server, emitted files, database, provider, timers or dependencies are needed.
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = async name => readFile(new URL(`../worker/lib/${name}.ts`, import.meta.url), 'utf8');
const compile = value => ts.transpileModule(value, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const dataUrl = value => `data:text/javascript;base64,${Buffer.from(value).toString('base64')}`;
const contractUrl = dataUrl(compile(await source('scheduler-contract')));
const stateUrl = dataUrl(compile(await source('scheduler-state')).replace("'./scheduler-contract'", JSON.stringify(contractUrl)));
const originals = { fetch: globalThis.fetch, setTimeout: globalThis.setTimeout, setInterval: globalThis.setInterval };
let sideEffects = 0;
let contract, model;
try {
  for (const key of Object.keys(originals)) globalThis[key] = () => { sideEffects++; throw new Error('Unexpected side effect'); };
  contract = await import(contractUrl);
  model = await import(stateUrl);
} finally { Object.assign(globalThis, originals); }
const { validateScheduleTime, validateSnapshot, validatePolicy, assessAdmission, approvalIdentity, executionKey } = contract;
const { createSchedule, transition } = model;
const ok = result => { assert.equal(result.ok, true, result.error); return result.value; };
const error = (result, expected) => { assert.deepEqual(result, { ok: false, error: expected }); };

// These are explicitly fictional test policies/grants, not product defaults or verified connectors.
const wall = { localDateTime: '2027-01-15T12:00', timezone: 'Europe/Berlin', utcOffset: '+01:00', confirmed: true };
const due = Date.parse('2027-01-15T11:00:00Z');
const material = { projectId: 'project-a', channel: 'instagram', connectionId: 'connection-a', destinationId: 'ig-a',
  caption: 'Ergebnis 🖤', mediaId: 'photo-a', mediaRole: 'optimized', storageKey: 'immutable/photo-a.jpg',
  mediaSha256: 'a'.repeat(64), mimeType: 'image/jpeg', mediaBytes: 100,
  connectorVersion: 'fixture-only-v1', mediaProfile: 'fixture-image', executionOwner: 'dfbk' };
const policy = { horizonMs: 3_600_000, latenessMs: 120_000, maxAttempts: 2 };
const gates = { enabled: true, entitlement: true, ownership: true, mediaImmutable: true, authorized: true, tokenValid: true,
  capability: { verified: true, scheduleEligible: true, channel: 'instagram', connectionId: 'connection-a', destinationId: 'ig-a',
    connectorVersion: 'fixture-only-v1', mediaProfile: 'fixture-image', maxCaptionCodePoints: 100, executionOwner: 'dfbk' } };
const tokenA = 'lease_A_123456789';
const tokenB = 'lease_B_123456789';
const fresh = () => ok(createSchedule('schedule-a', material, wall));
const approve = (state = fresh()) => ok(transition(state, state.version, { type: 'approve', identity: approvalIdentity(state.snapshot, state.time), policy, gates }, due - 60_000));
const claimAction = (token = tokenA, leaseExpiresAt = due + 30_000) => ({ type: 'claim', token, leaseExpiresAt, policy, gates });
const running = () => ok(transition(approve(), 1, claimAction(), due));
const checkpoint = state => ok(transition(state, state.version, { type: 'checkpoint', token: state.lease.token, policy, gates }, due + 1));

test('imports and pure transitions never invoke network or timers', () => {
  try {
    for (const key of Object.keys(originals)) globalThis[key] = () => { sideEffects++; throw new Error('Unexpected side effect'); };
    const state = checkpoint(running());
    assert.equal(ok(transition(state, 1, { type: 'published', token: tokenA, postId: 'post-1' }, due + 2)).status, 'published');
  } finally { Object.assign(globalThis, originals); }
  assert.equal(sideEffects, 0);
});

test('Berlin winter/summer convert to UTC and require explicit confirmation/offset', () => {
  assert.equal(ok(validateScheduleTime(wall)).scheduledAt, due);
  assert.equal(ok(validateScheduleTime({ ...wall, localDateTime: '2027-07-15T12:00', utcOffset: '+02:00' })).scheduledAt, Date.parse('2027-07-15T10:00:00Z'));
  error(validateScheduleTime({ ...wall, confirmed: false }), 'INVALID_TIME_CONFIRMATION');
  error(validateScheduleTime({ ...wall, utcOffset: undefined }), 'OFFSET_REQUIRED');
  error(validateScheduleTime({ ...wall, utcOffset: '+02:00' }), 'OFFSET_ZONE_MISMATCH');
  error(validateScheduleTime({ ...wall, timezone: 'UTC' }), 'INVALID_TIME_CONFIRMATION');
});

test('spring gap rejects and autumn fold produces two distinct explicitly selected instants', () => {
  error(validateScheduleTime({ ...wall, localDateTime: '2027-03-28T02:30' }), 'NONEXISTENT_LOCAL_TIME');
  const fold = { ...wall, localDateTime: '2027-10-31T02:30' };
  error(validateScheduleTime({ ...fold, utcOffset: undefined }), 'AMBIGUOUS_OFFSET_REQUIRED');
  const earlier = ok(validateScheduleTime({ ...fold, utcOffset: '+02:00' }));
  const later = ok(validateScheduleTime({ ...fold, utcOffset: '+01:00' }));
  assert.equal(later.scheduledAt - earlier.scheduledAt, 3_600_000);
  assert.equal(new Date(earlier.scheduledAt).toISOString(), '2027-10-31T00:30:00.000Z');
});

test('invalid dates, normalized overflow, offset formats and non-finite clocks fail closed', () => {
  for (const localDateTime of ['2027-02-30T12:00', '2027-13-01T12:00', '2027-01-01T24:00', '2027-01-01', 'garbage']) assert.equal(validateScheduleTime({ ...wall, localDateTime }).ok, false);
  error(validateScheduleTime({ ...wall, utcOffset: '+01' }), 'INVALID_OFFSET');
  error(transition(fresh(), 1, { type: 'cancel' }, NaN), 'INVALID_CLOCK');
});

test('snapshot validates media identity, text and exact destination; copies caller input', () => {
  for (const change of [{ caption: '' }, { caption: '\u0000bad' }, { mediaId: '' }, { destinationId: '' }, { mediaBytes: -1 }, { mediaSha256: 'bad' }, { channel: 'made-up' }, { executionOwner: 'both' }]) assert.equal(validateSnapshot({ ...material, ...change }).ok, false);
  const input = { ...material };
  const state = ok(createSchedule('schedule-a', input, wall));
  input.caption = 'changed';
  assert.equal(state.snapshot.caption, material.caption);
  assert.equal(state.approval, null);
  error(transition(state, 1, claimAction(), due), 'CLAIM_CONFLICT');
});

test('snapshot enum fields reject arrays and custom-toString objects without coercion', () => {
  for (const [field, literals] of [['mediaRole', ['original', 'optimized']], ['executionOwner', ['dfbk', 'provider']]]) {
    for (const literal of literals) {
      for (const value of [[literal], { toString() { throw new Error('Coercion must not run'); } }, { toString() { return literal; } }]) {
        const input = { ...material, [field]: value };
        error(validateSnapshot(input), 'INVALID_SNAPSHOT');
        error(createSchedule('schedule-a', input, wall), 'INVALID_SNAPSHOT');
        error(assessAdmission(input, fresh().time, due, policy, gates, 'plan', 0), 'INVALID_SNAPSHOT_OR_TIME');
      }
    }
  }
});

test('policy is explicit: absent, partial, negative, noninteger and unbounded values rejected', () => {
  error(validatePolicy(undefined), 'POLICY_REQUIRED');
  for (const input of [{}, { ...policy, horizonMs: Infinity }, { ...policy, latenessMs: -1 }, { ...policy, maxAttempts: 0 }, { ...policy, maxAttempts: 1.5 }]) error(validatePolicy(input), 'INVALID_POLICY');
  const state = fresh();
  error(transition(state, 1, { type: 'approve', identity: approvalIdentity(state.snapshot, state.time), gates }, due), 'POLICY_REQUIRED');
});

test('each permission and connector gate is explicit, no ordinary-share entitlement substitution', () => {
  const state = fresh();
  const admit = value => assessAdmission(state.snapshot, state.time, due, policy, value, 'plan', 0);
  error(admit(undefined), 'NOT_ENABLED');
  for (const field of ['enabled', 'entitlement', 'ownership', 'mediaImmutable', 'authorized', 'tokenValid']) {
    for (const value of [false, undefined]) assert.equal(admit({ ...gates, [field]: value }).ok, false, field);
  }
  error(admit({ ...gates, entitlement: undefined, share: true }), 'GATE_ENTITLEMENT');
  for (const field of ['verified', 'scheduleEligible']) error(admit({ ...gates, capability: { ...gates.capability, [field]: false } }), 'CONNECTOR_NOT_ENABLED');
});

test('capability must match approved channel/account/profile and exactly one execution owner', () => {
  const state = fresh();
  for (const field of ['channel', 'connectionId', 'destinationId', 'connectorVersion', 'mediaProfile', 'executionOwner']) {
    error(assessAdmission(state.snapshot, state.time, due, policy, { ...gates, capability: { ...gates.capability, [field]: 'other' } }, 'plan', 0), 'CAPABILITY_SNAPSHOT_MISMATCH');
  }
  const native = { ...material, executionOwner: 'provider' };
  error(assessAdmission(native, state.time, due, policy, { ...gates, capability: { ...gates.capability, executionOwner: 'provider' } }, 'plan', 0), 'EXECUTION_OWNER_NOT_DFBK');
  error(assessAdmission(state.snapshot, state.time, due, policy, { ...gates, capability: { ...gates.capability, maxCaptionCodePoints: 1 } }, 'plan', 0), 'CAPTION_PROFILE_LIMIT');
});

test('approved horizon/lateness/budget boundaries use fake clock with no implicit late dispatch', () => {
  const state = fresh();
  const check = (now, phase, attempts = 0) => assessAdmission(state.snapshot, state.time, now, policy, gates, phase, attempts);
  assert.equal(check(due - policy.horizonMs, 'plan').ok, true);
  error(check(due - policy.horizonMs - 1, 'plan'), 'OUTSIDE_HORIZON');
  error(check(due - 1, 'dispatch'), 'NOT_DUE');
  assert.equal(check(due + policy.latenessMs, 'dispatch').ok, true);
  error(check(due + policy.latenessMs + 1, 'dispatch'), 'MISSED_WINDOW');
  error(check(due, 'dispatch', policy.maxAttempts), 'ATTEMPT_BUDGET_EXHAUSTED');
  error(assessAdmission(state.snapshot, { ...state.time, scheduledAt: due + 1 }, due, policy, gates, 'plan', 0), 'INVALID_SNAPSHOT_OR_TIME');
});

test('editing revokes approval, increments version/key and rejects stale approval or claim', () => {
  const original = approve();
  const edited = ok(transition(original, 1, { type: 'edit', snapshot: { ...material, caption: 'Neu' }, time: wall }, due - 1));
  assert.equal(original.version, 1);
  assert.equal(edited.version, 2);
  assert.equal(edited.approval, null);
  assert.notEqual(edited.executionKey, original.executionKey);
  error(transition(edited, 1, claimAction(), due), 'VERSION_CONFLICT');
  error(transition(edited, 2, claimAction(), due), 'CLAIM_CONFLICT');
  error(transition(edited, 2, { type: 'approve', identity: original.approval.identity, policy, gates }, due - 1), 'APPROVAL_SNAPSHOT_MISMATCH');
});

test('claim/cancel/edit races are explicit model conflicts, not proof of D1 concurrency', () => {
  const state = approve();
  const cancelled = ok(transition(state, 1, { type: 'cancel' }, due));
  error(transition(cancelled, 1, claimAction(), due), 'VERSION_CONFLICT');
  const claimed = ok(transition(state, 1, claimAction(), due));
  error(transition(claimed, 1, { type: 'cancel' }, due), 'CANCEL_CONFLICT');
  error(transition(claimed, 1, { type: 'edit', snapshot: material, time: wall }, due), 'EDIT_CONFLICT');
  error(transition(claimed, 1, claimAction(tokenB), due), 'CLAIM_CONFLICT');
});

test('expired pre-checkpoint lease can reclaim with same execution key and new fence only', () => {
  const first = running();
  error(transition(first, 1, { type: 'expire' }, due + 29_999), 'LEASE_NOT_EXPIRED');
  const expired = ok(transition(first, 1, { type: 'expire' }, due + 30_000));
  assert.equal(expired.status, 'scheduled');
  error(transition(expired, 1, claimAction(tokenA, due + 60_000), due + 30_000), 'LEASE_TOKEN_REUSED');
  const second = ok(transition(expired, 1, claimAction(tokenB, due + 60_000), due + 30_000));
  assert.equal(second.executionKey, first.executionKey);
  assert.equal(second.attempts, 2);
  error(transition(second, 1, { type: 'checkpoint', token: tokenA, policy, gates }, due + 30_001), 'FENCE_CONFLICT');
  const exhausted = ok(transition(second, 1, { type: 'expire' }, due + 60_000));
  error(transition(exhausted, 1, claimAction('lease_C_123456789', due + 90_000), due + 60_000), 'ATTEMPT_BUDGET_EXHAUSTED');
});

test('checkpoint rechecks grants, immutability, deadline and frozen approved policy', () => {
  const state = running();
  for (const field of ['enabled', 'entitlement', 'ownership', 'mediaImmutable', 'authorized', 'tokenValid']) {
    assert.equal(transition(state, 1, { type: 'checkpoint', token: tokenA, policy, gates: { ...gates, [field]: false } }, due + 1).ok, false, field);
  }
  error(transition(state, 1, { type: 'checkpoint', token: tokenA, policy: { ...policy, maxAttempts: 99 }, gates }, due + 1), 'APPROVED_POLICY_REQUIRED');
  error(transition(state, 1, { type: 'checkpoint', token: tokenA, policy, gates }, due + 30_000), 'FENCE_CONFLICT');
  const checked = checkpoint(state);
  error(transition(checked, 1, { type: 'checkpoint', token: tokenA, policy, gates }, due + 2), 'CHECKPOINT_ALREADY_SET');
});

test('possible external success plus restart becomes unknown; no claim/edit/cancel/blind retry', () => {
  const state = checkpoint(running());
  const unknown = ok(transition(state, 1, { type: 'expire' }, due + 30_000));
  assert.equal(unknown.status, 'unknown');
  assert.equal(unknown.executionKey, state.executionKey);
  error(transition(unknown, 1, claimAction(tokenB, due + 60_000), due + 30_000), 'CLAIM_CONFLICT');
  error(transition(unknown, 1, { type: 'cancel' }, due + 30_000), 'CANCEL_CONFLICT');
  error(transition(unknown, 1, { type: 'published', token: tokenA, postId: 'late-result' }, due + 30_000), 'FENCE_OR_CHECKPOINT_CONFLICT');
  const reconciled = ok(transition(unknown, 1, { type: 'reconcile', evidence: { outcome: 'published', postId: 'verified-post-id' } }, due + 40_000));
  assert.equal(reconciled.status, 'published');
  assert.equal(reconciled.evidence.postId, 'verified-post-id');
});

test('uncertain outcome can only resolve with evidence, proven absence never requeues', () => {
  const unknown = ok(transition(checkpoint(running()), 1, { type: 'uncertain', token: tokenA }, due + 2));
  error(transition(unknown, 1, { type: 'reconcile', evidence: { outcome: 'published', postId: '' } }, due + 3), 'INVALID_EVIDENCE');
  const failed = ok(transition(unknown, 1, { type: 'reconcile', evidence: { outcome: 'not_published', reference: 'fixture-provider-proof' } }, due + 3));
  assert.equal(failed.status, 'failed');
  assert.equal(failed.evidence.reference, 'fixture-provider-proof');
  error(transition(failed, 1, claimAction(), due + 4), 'CLAIM_CONFLICT');
});

test('only pre-checkpoint failures may become failed/reconnect_required', () => {
  for (const reason of ['failed', 'reconnect_required']) {
    assert.equal(ok(transition(running(), 1, { type: 'blocked', token: tokenA, reason }, due + 1)).status, reason);
    error(transition(checkpoint(running()), 1, { type: 'blocked', token: tokenA, reason }, due + 2), 'FENCE_OR_CHECKPOINT_CONFLICT');
  }
  error(transition(running(), 1, { type: 'published', token: tokenA, postId: 'post' }, due + 1), 'FENCE_OR_CHECKPOINT_CONFLICT');
});

test('execution key is stable per version, cannot alias another schedule, rejects unsafe identity', () => {
  assert.equal(executionKey('schedule-a', 1), executionKey('schedule-a', 1));
  assert.notEqual(executionKey('schedule-a', 1), executionKey('schedule-a', 2));
  assert.notEqual(executionKey('schedule-a', 1), executionKey('schedule-b', 1));
  assert.throws(() => executionKey('a:b', 1));
  assert.throws(() => executionKey('a', 0));
});

test('approval binds time/media/account/caption, copied transition leaves the previous state untouched', () => {
  const approved = approve();
  const before = structuredClone(approved);
  for (const change of [{ caption: 'Another text' }, { mediaId: 'another-photo' }, { destinationId: 'another-account' }]) {
    error(transition({ ...approved, snapshot: { ...approved.snapshot, ...change } }, 1, claimAction(), due), 'CLAIM_CONFLICT');
  }
  const moved = ok(validateScheduleTime({ ...wall, localDateTime: '2027-01-15T12:01' }));
  error(transition({ ...approved, time: moved }, 1, claimAction(), due + 60_000), 'CLAIM_CONFLICT');
  const claimed = ok(transition(approved, 1, claimAction(), due));
  claimed.snapshot.caption = 'Caller modification';
  assert.deepEqual(approved, before);
});

test('a frozen policy cannot be replaced during claim; missing entitlement never enables admission', () => {
  const state = approve();
  error(transition(state, 1, { ...claimAction(), policy: undefined }, due), 'APPROVED_POLICY_REQUIRED');
  error(transition(state, 1, { ...claimAction(), policy: { ...policy, latenessMs: 999_999 } }, due), 'APPROVED_POLICY_REQUIRED');
  error(transition(state, 1, { ...claimAction(), gates: { ...gates, entitlement: undefined } }, due), 'GATE_ENTITLEMENT');
});

test('missed execution and expired budget remain non-admitted; success requires current fence', () => {
  const approved = approve();
  error(transition(approved, 1, claimAction(tokenA, due + policy.latenessMs + 60_000), due + policy.latenessMs + 1), 'MISSED_WINDOW');
  const checked = checkpoint(running());
  error(transition(checked, 1, { type: 'published', token: tokenB, postId: 'post' }, due + 2), 'FENCE_OR_CHECKPOINT_CONFLICT');
  const success = ok(transition(checked, 1, { type: 'published', token: tokenA, postId: 'post' }, due + 2));
  assert.equal(success.evidence.outcome, 'published');
  error(transition(success, 1, claimAction(tokenB), due + 3), 'CLAIM_CONFLICT');
});

test('a regressed fake clock cannot report publication before the side-effect checkpoint', () => {
  const checked = checkpoint(running());
  error(transition(checked, 1, { type: 'published', token: tokenA, postId: 'post' }, due), 'CLOCK_REGRESSION');
  error(transition(checked, 1, { type: 'published', token: tokenA, postId: 'post' }, due + 30_000), 'FENCE_OR_CHECKPOINT_CONFLICT');
});
