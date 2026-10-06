import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const vite = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
});

const { parseBackendUtcTimestamp, formatProjectDate, projectDateValue } =
  await vite.ssrLoadModule('/src/lib/project-date.ts');

after(async () => {
  await vite.close();
});

test('SQLite project timestamps are interpreted explicitly as UTC', () => {
  const parsed = parseBackendUtcTimestamp('2026-10-06 00:30:00');
  assert.ok(parsed);
  assert.equal(parsed.toISOString(), '2026-10-06T00:30:00.000Z');
  assert.equal(projectDateValue('2026-10-06 00:30:00'), Date.parse('2026-10-06T00:30:00Z'));
});

test('project date formatting never emits Invalid Date', () => {
  assert.equal(parseBackendUtcTimestamp('not-a-date'), null);
  assert.equal(formatProjectDate('not-a-date'), 'Datum nicht verfügbar');
  assert.match(formatProjectDate('2026-10-06 00:30:00'), /^06\.10\.2026$/);
});
