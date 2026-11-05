import { test } from 'node:test';
import assert from 'node:assert/strict';
import { progressStats } from '../js/core/stats.js';
import { buildModel } from '../js/core/model.js';
import { newTrickText } from '../js/core/trick.js';
import { mk, sess } from './helpers.js';

test('progressStats counts sessions, days and learned tricks', () => {
  const tricks = [
    mk('a', { status: 'known', known_since: '2026-11-02' }),
    mk('b', { status: 'known', known_since: '2026-10-02' }),
    mk('c', { status: 'learning' }),
    mk('g', { type: 'game', status: 'known' }),
  ];
  const sessions = [
    sess('2026-10-31T10:00:00', []),
    sess('2026-11-02T10:00:00', []),
    sess('2026-11-02T18:00:00', []),
    sess('2026-11-06T10:00:00', []),
  ];
  const s = progressStats(tricks, sessions, new Date(2026, 10, 8, 12));
  assert.equal(s.week, 3);
  assert.equal(s.month, 3);
  assert.deepEqual([...s.days].sort(), ['2026-11-02', '2026-11-06']);
  assert.deepEqual(s.learnedThisMonth.map((t) => t.slug), ['a']);
  assert.deepEqual(s.counts, { want: 0, learning: 1, reinforcing: 0, known: 2 });
  assert.deepEqual(s.learning.map((t) => t.slug), ['c']);
  assert.equal(s.monthKey, '2026-11');
});

test('buildModel parses tricks, logs and settings', () => {
  const view = new Map([
    ['tricks/b/trick.md', newTrickText({ name: 'Бочка' })],
    ['tricks/a/trick.md', newTrickText({ name: 'Апорт' })],
    ['log/2026-11.json', JSON.stringify([{ id: '2026-11-01T10:00:00', place: 'home', items: [] }])],
    ['settings.json', '{"props":["toy"]}'],
    ['README.md', '# x'],
  ]);
  const m = buildModel(view);
  assert.deepEqual(m.tricks.map((t) => t.meta.name), ['Апорт', 'Бочка']);
  assert.equal(m.sessions.length, 1);
  assert.deepEqual(m.settings, { props: ['toy'], learningLimit: 2 });
  assert.equal(m.bySlug.get('b').meta.name, 'Бочка');
});

test('buildModel survives broken settings', () => {
  assert.deepEqual(buildModel(new Map([['settings.json', '{oops']])).settings, { props: [], learningLimit: 2 });
});
