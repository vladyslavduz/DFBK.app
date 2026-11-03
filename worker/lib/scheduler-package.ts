/** Pure draft composition only: no authentication, persistence, approval or dispatch. */
import { accept, reject, validInstant, validateScheduleTime, validateSnapshot, type Result, type ScheduleTime, type Channel } from './scheduler-contract';
import { createSchedule, type Model } from './scheduler-state';

export type TargetKind = 'account' | 'board' | 'blog' | 'email_recipient' | 'whatsapp_status' | 'whatsapp_channel' | 'whatsapp_recipient';
const kinds: Partial<Record<Channel, readonly TargetKind[]>> = {
  instagram: ['account'], facebook: ['account'], pinterest: ['board'], x: ['account'], linkedin: ['account'],
  website: ['blog'], email: ['email_recipient'], whatsapp: ['whatsapp_status', 'whatsapp_channel', 'whatsapp_recipient'],
};
const snapshotKeys = ['projectId', 'channel', 'connectionId', 'destinationId', 'caption', 'mediaId', 'mediaRole', 'storageKey', 'mediaSha256', 'mimeType', 'mediaBytes', 'connectorVersion', 'mediaProfile', 'executionOwner'];
const timeKeys = ['localDateTime', 'timezone', 'utcOffset', 'confirmed'];
type DeepReadonly<T> = T extends object ? { readonly [P in keyof T]: DeepReadonly<T[P]> } : T;
type DraftItem = { targetKind: TargetKind; timeSource: 'common' | 'override'; schedule: Model };
export type PackageDraft = DeepReadonly<{
  schemaVersion: 1; id: string; ownerId: string; projectId: string; version: 1; status: 'draft';
  commonTime: ScheduleTime; policy: { maxTargets: number; horizonMs: number }; items: DraftItem[];
  draftIdentity: string; cannotDispatch: true;
}>;

// Read data properties without executing getters or silently dropping extra input.
function dataRecord(value: unknown, required: readonly string[], optional: readonly string[] = []): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return null;
  const output: Record<string, unknown> = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || (!required.includes(key) && !optional.includes(key))) return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) return null;
    output[key] = descriptor.value;
  }
  return required.every(key => Object.hasOwn(output, key)) ? output : null;
}
function denseArray(value: unknown, max: number): unknown[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > max || Object.getPrototypeOf(value) !== Array.prototype) return null;
  if (Reflect.ownKeys(value).length !== value.length + 1) return null;
  const output = [];
  for (let i = 0; i < value.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) return null;
    output.push(descriptor.value);
  }
  return output;
}
const id = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
function freeze<T>(value: T): DeepReadonly<T> {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

/** Input is a future trusted-service projection, NOT a public API authority proof.
 * IDs, clock and explicit fictional/approved limits are supplied, never generated here.
 * A successful draft is never permission to send or evidence that a connector exists.
 */
export function createPublicationPackage(input: unknown, now: number, limits: unknown): Result<PackageDraft> {
  try {
    if (!validInstant(now)) return reject('INVALID_PACKAGE_CLOCK');
    const policy = dataRecord(limits, ['maxTargets', 'horizonMs']);
    // 1000 is a technical parsing ceiling, not a subscription or product default.
    if (!policy || !Number.isSafeInteger(policy.maxTargets) || Number(policy.maxTargets) < 1 || Number(policy.maxTargets) > 1000 ||
        !Number.isSafeInteger(policy.horizonMs) || Number(policy.horizonMs) <= 0) return reject('PACKAGE_LIMITS_REQUIRED');
    const request = dataRecord(input, ['id', 'ownerId', 'projectId', 'commonTime', 'items']);
    if (!request || !id(request.id) || !id(request.ownerId) || !id(request.projectId)) return reject('INVALID_PACKAGE');
    const rows = denseArray(request.items, Number(policy.maxTargets));
    if (!rows) return reject('INVALID_PACKAGE_ITEMS');
    const commonInput = dataRecord(request.commonTime, timeKeys);
    const common = validateScheduleTime(commonInput);
    if (!common.ok) return common;
    const inWindow = (time: ScheduleTime) => {
      const distance = time.scheduledAt - now;
      return Number.isSafeInteger(distance) && distance >= 0 && distance <= Number(policy.horizonMs);
    };
    if (!inWindow(common.value)) return reject('PACKAGE_OUTSIDE_HORIZON');
    const scheduleIds = new Set<string>(), targets = new Set<string>();
    const items: DraftItem[] = [];
    for (const row of rows) {
      const item = dataRecord(row, ['scheduleId', 'targetKind', 'snapshot'], ['timeOverride']);
      if (!item || !id(item.scheduleId) || typeof item.targetKind !== 'string') return reject('INVALID_PACKAGE_ITEM');
      if (scheduleIds.has(item.scheduleId)) return reject('DUPLICATE_PACKAGE_SCHEDULE');
      const material = validateSnapshot(dataRecord(item.snapshot, snapshotKeys));
      if (!material.ok) return material;
      if (material.value.projectId !== request.projectId) return reject('PACKAGE_PROJECT_MISMATCH');
      if (material.value.executionOwner !== 'dfbk') return reject('PACKAGE_EXECUTION_OWNER_MISMATCH');
      const allowed = Object.hasOwn(kinds, material.value.channel) ? kinds[material.value.channel] : undefined;
      if (!allowed?.includes(item.targetKind as TargetKind)) return reject('INVALID_PACKAGE_TARGET_KIND');
      const tuple = JSON.stringify([material.value.channel, material.value.connectionId, material.value.destinationId, item.targetKind]);
      if (targets.has(tuple)) return reject('DUPLICATE_PACKAGE_TARGET');
      const overridden = Object.hasOwn(item, 'timeOverride');
      const timeInput = overridden ? dataRecord(item.timeOverride, timeKeys) : commonInput;
      const time = validateScheduleTime(timeInput);
      if (!time.ok) return time;
      if (!inWindow(time.value)) return reject('PACKAGE_OUTSIDE_HORIZON');
      const schedule = createSchedule(item.scheduleId, material.value, timeInput);
      if (!schedule.ok) return schedule;
      scheduleIds.add(item.scheduleId); targets.add(tuple);
      items.push({ targetKind: item.targetKind as TargetKind, timeSource: overridden ? 'override' : 'common', schedule: schedule.value });
    }
    // Checkbox ordering is not publication identity. Keep display order separately.
    const identityItems = [...items].sort((a, b) => a.schedule.id < b.schedule.id ? -1 : a.schedule.id > b.schedule.id ? 1 : 0);
    const header = { schemaVersion: 1 as const, id: request.id, ownerId: request.ownerId, projectId: request.projectId,
      version: 1 as const, status: 'draft' as const, commonTime: common.value,
      policy: { maxTargets: Number(policy.maxTargets), horizonMs: Number(policy.horizonMs) } };
    // Comparison identity only: not a signature, approval, idempotency receipt or credential.
    const draftIdentity = JSON.stringify({ ...header, items: identityItems });
    return accept(freeze({ ...header, items, draftIdentity, cannotDispatch: true as const }));
  } catch { return reject('INVALID_PACKAGE'); }
}
