export function parseBackendUtcTimestamp(value: string): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalized = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(value)
    ? value.replace(' ', 'T') + 'Z'
    : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatProjectDate(value: string, long = false) {
  const date = parseBackendUtcTimestamp(value);
  if (!date) return 'Datum nicht verfügbar';
  return new Intl.DateTimeFormat('de-DE', long
    ? { dateStyle: 'long', timeZone: 'Europe/Berlin' }
    : { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' }
  ).format(date);
}

export function projectDateValue(value: string) {
  return parseBackendUtcTimestamp(value)?.getTime() ?? 0;
}
