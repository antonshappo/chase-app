import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localIso, dayKey, monthKey, logPath, parseLogs, entriesFor, lastPracticed } from '../js/core/log.js';

test('localIso formats local time without timezone', () => {
  assert.equal(localIso(new Date(2026, 10, 5, 9, 7, 3)), '2026-11-05T09:07:03');
  assert.equal(dayKey('2026-11-05T09:07:03'), '2026-11-05');
  assert.equal(monthKey('2026-11-05T09:07:03'), '2026-11');
  assert.equal(logPath('2026-11-05T09:07:03'), 'log/2026-11.json');
});

const view = new Map([
  ['log/2026-11.json', JSON.stringify([
    { id: '2026-11-03T10:00:00', place: 'outdoor', items: [{ trick: 'a', block: 'repeat', level: 'park', result: 'good' }] },
  ])],
  ['log/2026-10.json', JSON.stringify([
    { id: '2026-10-30T10:00:00', place: 'home', items: [{ trick: 'a', block: 'new', step: 2, result: 'ok' }, { trick: 'b', block: 'game', result: null }] },
  ])],
  ['log/broken.json', 'not json'],
  ['log/2026-09.json', 'not json'],
  ['tricks/a/trick.md', 'x'],
]);

test('parseLogs merges months, sorts and ignores broken files', () => {
  assert.deepEqual(parseLogs(view).map((s) => s.id), ['2026-10-30T10:00:00', '2026-11-03T10:00:00']);
});

test('entriesFor returns history of one trick', () => {
  assert.deepEqual(entriesFor('a', parseLogs(view)), [
    { date: '2026-10-30T10:00:00', place: 'home', block: 'new', step: 2, level: null, result: 'ok' },
    { date: '2026-11-03T10:00:00', place: 'outdoor', block: 'repeat', step: null, level: 'park', result: 'good' },
  ]);
});

test('lastPracticed maps slug to latest session id', () => {
  const m = lastPracticed(parseLogs(view));
  assert.equal(m.get('a'), '2026-11-03T10:00:00');
  assert.equal(m.get('b'), '2026-10-30T10:00:00');
});
