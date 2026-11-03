/** Pure local model only. No connector, entitlement or execution is enabled here. */
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
export const reject = (error: string): Result<never> => ({ ok: false, error });
export const accept = <T>(value: T): Result<T> => ({ ok: true, value });
export const CHANNELS = ['instagram', 'facebook', 'pinterest', 'whatsapp', 'x', 'linkedin', 'email', 'google_business', 'website'] as const;
export type Channel = typeof CHANNELS[number];
export type ScheduleTime = {
  localDateTime: string; timezone: 'Europe/Berlin'; utcOffset: string; scheduledAt: number;
};
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && !!value.trim() && !/[\u0000-\u001f\u007f]/u.test(value);
export const validInstant = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && Number.isFinite(new Date(value).getTime());

/** Explicit wall-clock/zone/offset confirmation; never guess the autumn fold. */
export function validateScheduleTime(input: unknown): Result<ScheduleTime> {
  if (!record(input) || input.timezone !== 'Europe/Berlin' || input.confirmed !== true ||
      typeof input.localDateTime !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input.localDateTime)) return reject('INVALID_TIME_CONFIRMATION');
  const wall = `${input.localDateTime}:00.000Z`;
  const naive = Date.parse(wall);
  if (!validInstant(naive) || new Date(naive).toISOString() !== wall) return reject('INVALID_LOCAL_TIME');
  const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  function wallAt(instant: number): number {
    const parts = Object.fromEntries(formatter.formatToParts(instant).map(part => [part.type, part.value]));
    return Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.000Z`);
  }
  // Collect actual zone offsets on both sides of a possible transition, not a hardcoded CET/CEST table.
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const instant = naive + hours * 3_600_000;
    offsets.add(wallAt(instant) - instant);
  }
  const candidates = [...offsets].filter(offset => wallAt(naive - offset) === naive);
  if (!candidates.length) return reject('NONEXISTENT_LOCAL_TIME');
  if (input.utcOffset === undefined) return reject(candidates.length > 1 ? 'AMBIGUOUS_OFFSET_REQUIRED' : 'OFFSET_REQUIRED');
  if (typeof input.utcOffset !== 'string' || !/^[+-](?:0\d|1[0-4]):[0-5]\d$/.test(input.utcOffset)) return reject('INVALID_OFFSET');
  const offset = (Number(input.utcOffset.slice(1, 3)) * 60 + Number(input.utcOffset.slice(4))) * 60_000 * (input.utcOffset[0] === '+' ? 1 : -1);
  if (!candidates.includes(offset)) return reject('OFFSET_ZONE_MISMATCH');
  return accept({ localDateTime: input.localDateTime, timezone: 'Europe/Berlin', utcOffset: input.utcOffset, scheduledAt: naive - offset });
}

export type Snapshot = {
  projectId: string; channel: Channel; connectionId: string; destinationId: string;
  caption: string; mediaId: string; mediaRole: 'original' | 'optimized';
  storageKey: string; mediaSha256: string; mimeType: string; mediaBytes: number;
  connectorVersion: string; mediaProfile: string; executionOwner: 'dfbk' | 'provider';
};
export function validateSnapshot(input: unknown): Result<Snapshot> {
  if (!record(input)) return reject('INVALID_SNAPSHOT');
  for (const key of ['projectId', 'connectionId', 'destinationId', 'mediaId', 'storageKey', 'connectorVersion', 'mediaProfile']) {
    if (!text(input[key])) return reject('INVALID_SNAPSHOT');
  }
  if (!CHANNELS.includes(input.channel as Channel) || typeof input.caption !== 'string' || !input.caption.trim() ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(input.caption) ||
      (input.mediaRole !== 'original' && input.mediaRole !== 'optimized') ||
      (input.executionOwner !== 'dfbk' && input.executionOwner !== 'provider') ||
      typeof input.mediaSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(input.mediaSha256) || !text(input.mimeType) ||
      !Number.isSafeInteger(input.mediaBytes) || Number(input.mediaBytes) <= 0) return reject('INVALID_SNAPSHOT');
  // Explicit construction prevents unknown fields/order from changing approval identity.
  return accept({ projectId: input.projectId as string, channel: input.channel as Channel,
    connectionId: input.connectionId as string, destinationId: input.destinationId as string,
    caption: input.caption, mediaId: input.mediaId as string, mediaRole: input.mediaRole,
    storageKey: input.storageKey as string, mediaSha256: input.mediaSha256, mimeType: input.mimeType,
    mediaBytes: input.mediaBytes as number, connectorVersion: input.connectorVersion as string,
    mediaProfile: input.mediaProfile as string, executionOwner: input.executionOwner });
}

/** No working product defaults: these must come from separately approved policy. */
export type Policy = { horizonMs: number; latenessMs: number; maxAttempts: number };
export function validatePolicy(input: unknown): Result<Policy> {
  if (!record(input)) return reject('POLICY_REQUIRED');
  if (!Number.isSafeInteger(input.horizonMs) || Number(input.horizonMs) <= 0 ||
      !Number.isSafeInteger(input.latenessMs) || Number(input.latenessMs) < 0 ||
      !Number.isSafeInteger(input.maxAttempts) || Number(input.maxAttempts) <= 0) return reject('INVALID_POLICY');
  return accept({ horizonMs: input.horizonMs as number, latenessMs: input.latenessMs as number, maxAttempts: input.maxAttempts as number });
}
export type Gates = {
  enabled: boolean; entitlement: boolean; ownership: boolean; mediaImmutable: boolean;
  authorized: boolean; tokenValid: boolean;
  capability: { verified: boolean; scheduleEligible: boolean; channel: Channel; connectionId: string;
    destinationId: string; connectorVersion: string; mediaProfile: string; maxCaptionCodePoints: number; executionOwner: 'dfbk' | 'provider' };
};
export function assessAdmission(snapshot: Snapshot, time: ScheduleTime, now: number, policy: unknown, gates: unknown, phase: 'plan' | 'dispatch', attempts: number): Result<Policy> {
  const checked = validatePolicy(policy);
  if (!checked.ok) return checked;
  const material = validateSnapshot(snapshot);
  const instant = validateScheduleTime({ ...time, confirmed: true });
  if (!material.ok || !instant.ok || instant.value.scheduledAt !== time.scheduledAt) return reject('INVALID_SNAPSHOT_OR_TIME');
  if (phase !== 'plan' && phase !== 'dispatch') return reject('INVALID_PHASE');
  if (!validInstant(now) || !Number.isSafeInteger(attempts) || attempts < 0) return reject('INVALID_CLOCK_OR_ATTEMPTS');
  if (!record(gates)) return reject('NOT_ENABLED');
  for (const gate of ['enabled', 'entitlement', 'ownership', 'mediaImmutable', 'authorized', 'tokenValid']) {
    if (gates[gate] !== true) return reject(`GATE_${gate.toUpperCase()}`);
  }
  const cap = gates.capability;
  if (!record(cap) || cap.verified !== true || cap.scheduleEligible !== true) return reject('CONNECTOR_NOT_ENABLED');
  for (const field of ['channel', 'connectionId', 'destinationId', 'connectorVersion', 'mediaProfile', 'executionOwner'] as const) {
    if (cap[field] !== snapshot[field]) return reject('CAPABILITY_SNAPSHOT_MISMATCH');
  }
  if (!Number.isSafeInteger(cap.maxCaptionCodePoints) || Number(cap.maxCaptionCodePoints) <= 0 || Array.from(snapshot.caption).length > Number(cap.maxCaptionCodePoints)) return reject('CAPTION_PROFILE_LIMIT');
  // The local kernel models DFBK dispatch only, never a second timer for provider scheduling.
  if (snapshot.executionOwner !== 'dfbk') return reject('EXECUTION_OWNER_NOT_DFBK');
  if (phase === 'plan' && (time.scheduledAt < now || time.scheduledAt - now > checked.value.horizonMs)) return reject('OUTSIDE_HORIZON');
  if (phase === 'dispatch' && time.scheduledAt > now) return reject('NOT_DUE');
  if (now - time.scheduledAt > checked.value.latenessMs) return reject('MISSED_WINDOW');
  if (attempts >= checked.value.maxAttempts) return reject('ATTEMPT_BUDGET_EXHAUSTED');
  return checked;
}

/** Canonical comparison identity, NOT a cryptographic signature or trusted client proof. */
export function approvalIdentity(snapshot: Snapshot, time: ScheduleTime): string {
  return JSON.stringify({ snapshot, time });
}
export function executionKey(scheduleId: string, version: number): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(scheduleId) || !Number.isSafeInteger(version) || version < 1) throw new Error('INVALID_EXECUTION_IDENTITY');
  return `scheduler:v1:${scheduleId}:${version}`;
}
