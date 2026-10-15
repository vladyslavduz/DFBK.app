import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { createD1Database } from './helpers/backend.mjs';

function withDatabase(run) {
  return async () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys=ON; CREATE TABLE items(id TEXT PRIMARY KEY, label TEXT, payload BLOB)');
    try { await run(db, createD1Database(db)); } finally { db.close(); }
  };
}

test('D1 indexed binding supports run, first and all, including repeated and reordered indices', withDatabase(async (db, d1) => {
  assert.equal((await d1.prepare('INSERT INTO items(id,label) VALUES (?1,?2)').bind('a','first').run()).meta.changes, 1);
  assert.equal((await d1.prepare('SELECT label FROM items WHERE id=?1 OR id=?1').bind('a').first()).label, 'first');
  const rows = await d1.prepare('SELECT ?2 AS second, ?1 AS first, ?1 AS repeated').bind('A','B').all();
  assert.deepEqual({ ...rows.results[0] }, { second: 'B', first: 'A', repeated: 'A' });
  assert.equal((await d1.prepare('SELECT id FROM items WHERE id=?1').bind('missing').first()), null);
  assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
}));

test('D1 anonymous and mixed binding preserve value order, null and blobs', withDatabase(async (db, d1) => {
  const blob = new Uint8Array([0,1,255]);
  await d1.prepare('INSERT INTO items(id,label,payload) VALUES (?,?,?)').bind('a',null,blob).run();
  const row = await d1.prepare('SELECT label,payload FROM items WHERE id=?').bind('a').first();
  assert.equal(row.label, null);
  assert.deepEqual(new Uint8Array(row.payload), blob);
  const mixed = await d1.prepare('SELECT ?1 AS first, ? AS second, ?1 AS repeated').bind('A','B').first();
  assert.deepEqual({ ...mixed }, { first: 'A', second: 'B', repeated: 'A' });
}));

test('SQL strings, quoted identifiers and comments do not become bind parameters', withDatabase(async (db, d1) => {
  const row = await d1.prepare(`SELECT '?99' AS literal, 'it''s ?80' AS escaped, ?1 AS "?70"
    /* ?60 */ -- ?50
  `).bind('actual').first();
  assert.deepEqual({ ...row }, { literal: '?99', escaped: "it's ?80", '?70': 'actual' });
  assert.equal((await d1.prepare('SELECT 1 AS value').first()).value, 1);
}));

test('Missing and extra bind values fail explicitly rather than silently dropping checks', withDatabase(async (db, d1) => {
  await assert.rejects(d1.prepare('SELECT ?1 AS value').first(), /Expected 1 SQL bind values, received 0/);
  await assert.rejects(d1.prepare('SELECT ?1 AS value').bind('a','b').all(), /Expected 1 SQL bind values, received 2/);
  await assert.rejects(d1.prepare('INSERT INTO items(id) VALUES (?)').bind().run(), /Expected 1 SQL bind values, received 0/);
}));

test('Batch rollback and foreign key enforcement remain active with indexed bindings', withDatabase(async (db, d1) => {
  db.exec('CREATE TABLE children(id TEXT PRIMARY KEY, parent_id TEXT REFERENCES items(id))');
  await assert.rejects(d1.batch([
    d1.prepare('INSERT INTO items(id,label) VALUES (?1,?2)').bind('a','first'),
    d1.prepare('INSERT INTO children(id,parent_id) VALUES (?1,?2)').bind('child','missing'),
  ]), /FOREIGN KEY constraint failed/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM items').get().n, 0);
  await d1.batch([
    d1.prepare('INSERT INTO items(id,label) VALUES (?1,?2)').bind('a','first'),
    d1.prepare('INSERT INTO children(id,parent_id) VALUES (?1,?2)').bind('child','a'),
  ]);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM children').get().n, 1);
}));
