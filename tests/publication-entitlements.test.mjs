import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript'), modules = new Map();
function load(name) {
  if (modules.has(name)) return modules.get(name);
  const m = { exports: {} };
  const source = fs.readFileSync(new URL('../worker/lib/' + name + '.ts', import.meta.url), 'utf8');
  new Function('require', 'module', 'exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(p => { assert.ok(p.startsWith('./')); return load(p.slice(2)); }, m, m.exports);
  modules.set(name, m.exports); return m.exports;
}
const { evaluatePublicationEntitlement: evaluate, TRIAL_SEND_SCOPE, TRIAL_LIFETIME_PROJECT_LIMIT } = load('publication-entitlements');
const now = Date.parse('2026-11-04T12:00:00Z');
const trial = { plan: 'trial', access: 'active', trialExpiresAt: '2026-11-05 00:00:00' };
const usage = (consumed = 0, reserved = 0) => ({ scope: TRIAL_SEND_SCOPE, consumed, reserved });
const input = (values = {}) => ({ account: trial, usage: usage(), now, ...values });

test('active Trial target: 3 lifetime projects, 15 lifetime successful sends, reservations reduce available capacity', () => {
  assert.equal(TRIAL_LIFETIME_PROJECT_LIMIT, 3);
  const r = evaluate(input({ usage: usage(7, 3) }));
  assert.equal(r.status, 'available'); assert.equal(r.cannotDispatch, true);
  assert.deepEqual(r.budget, { unit: 'successful_send_per_channel', scope: TRIAL_SEND_SCOPE, limit: 15, consumed: 7, reserved: 3, remaining: 5 });
  assert.deepEqual(r.targetCapabilities, { channelSpecificText: true, publishNow: true, schedule: true });
});

test('consumed or reserved exhaustion blocks new admission without treating reservations as successes', () => {
  for (const [consumed, reserved] of [[15, 0], [0, 15], [8, 7]]) {
    const r = evaluate(input({ usage: usage(consumed, reserved) }));
    assert.equal(r.status, 'blocked'); assert.equal(r.reason, 'budget_exhausted'); assert.equal(r.budget.remaining, 0);
    assert.equal(r.budget.consumed, consumed); assert.equal(r.budget.reserved, reserved);
  }
});

test('invalid counters/scope/overflow fail closed; no coercion, negative remaining or fabricated zero usage', () => {
  for (const values of [usage(-1), usage(1.5), usage('1'), usage(NaN), usage(Infinity), usage(Number.MAX_SAFE_INTEGER), usage(14, 2), usage(0, -1),
    { ...usage(), scope: 'drafts_24h' }, { scope: TRIAL_SEND_SCOPE, consumed: 0 }, null]) {
    const r = evaluate(input({ usage: values })); assert.equal(r.status, 'blocked'); assert.equal(r.reason, 'invalid_usage'); assert.equal(r.budget.remaining, null);
  }
});

test('Trial expiry exactly follows existing helper, blocked/unknown access never revives; lifetime budget is not perpetual access', () => {
  for (const expiry of ['2026-11-04 12:00:00', '2026-11-01 00:00:00', 'bad', '2026-02-30 00:00:00']) {
    const r = evaluate(input({ account: { ...trial, trialExpiresAt: expiry } }));
    assert.equal(r.status, 'blocked'); assert.equal(r.reason, 'trial_inactive'); assert.equal(r.targetCapabilities.publishNow, false);
  }
  assert.equal(evaluate(input({ account: { ...trial, trialExpiresAt: null } })).status, 'available'); // Existing null semantics, not a new expiry policy.
  assert.equal(evaluate(input({ account: { plan: 'trial', access: 'active' } })).status, 'not_configured');
  for (const plan of ['trial', 'business']) {
    assert.equal(evaluate(input({ account: { ...trial, plan, access: 'blocked' } })).reason, 'account_blocked');
    const unknown = evaluate(input({ account: { ...trial, plan, access: 'unknown' } }));
    assert.equal(unknown.status, 'not_configured'); assert.equal(unknown.targetCapabilities.schedule, false);
  }
});

test('Business quota unknown: explicit scope+limit required, no unlimited default; target capabilities equal active Trial', () => {
  const base = input({ account: { plan: 'business', access: 'active' } });
  const missing = evaluate(base); assert.equal(missing.status, 'not_configured'); assert.equal(missing.reason, 'business_policy_required');
  assert.equal(missing.budget.limit, null); assert.equal(missing.budget.remaining, null);
  assert.deepEqual(missing.targetCapabilities, evaluate(input()).targetCapabilities);
  // Fictional explicit policy, not an approved Business product quota or cadence.
  const policy = { scope: 'fixture_approved_scope', limit: 27 };
  const r = evaluate({ ...base, businessPolicy: policy, usage: { scope: policy.scope, consumed: 12, reserved: 4 } });
  assert.equal(r.status, 'available'); assert.equal(r.budget.remaining, 11);
  for (const invalid of [{ scope: TRIAL_SEND_SCOPE, limit: 27 }, { scope: 'x', limit: Infinity }, { scope: '', limit: 27 }, { scope: 'x', limit: '27' }]) {
    assert.equal(evaluate({ ...base, businessPolicy: invalid }).reason, 'invalid_business_policy');
  }
});

test('calculation preserves input, has no implicit clock/network/DB writes, and accepts safe integer boundary', () => {
  const request = input(), before = structuredClone(request), previous = globalThis.fetch;
  try {
    globalThis.fetch = () => { throw Error('unexpected network'); };
    evaluate(request); assert.deepEqual(request, before);
  } finally { globalThis.fetch = previous; }
  const r = evaluate(input({ account: { plan: 'business', access: 'active' }, businessPolicy: { scope: 'fixture', limit: Number.MAX_SAFE_INTEGER }, usage: { scope: 'fixture', consumed: Number.MAX_SAFE_INTEGER - 2, reserved: 1 } }));
  assert.equal(r.budget.remaining, 1);
  for (const value of [null, {}, input({ now: NaN }), input({ now: 1.5 })]) assert.equal(evaluate(value).status, 'not_configured');
  const getter = {}; Object.defineProperty(getter, 'account', { enumerable: true, get() { throw Error('getter must not run'); } });
  assert.equal(evaluate(getter).status, 'not_configured');
});
// No retry/idempotency/consume test: this slice implements no reservation transitions
// or ledger. Those guarantees require the next durable atomic store increment.
