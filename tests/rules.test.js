import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestionsFor, allSuggestions, nextLevel, learningConflicts } from '../js/core/rules.js';
import { mk, sess } from './helpers.js';

const days = (list, item, place) => list.map((d) => sess(`2026-11-0${d}T10:00:00`, [item], place));

test('nextLevel walks home → yard → park → dogs', () => {
  assert.equal(nextLevel(null), 'yard');
  assert.equal(nextLevel('home'), 'yard');
  assert.equal(nextLevel('park'), 'dogs');
  assert.equal(nextLevel('dogs'), null);
});

test('suggests next step after 3 good in a row at current step', () => {
  const t = mk('x', { status: 'learning', step: 1 }, 3);
  const out = suggestionsFor(t, days([1, 2, 3], { trick: 'x', block: 'new', step: 1, result: 'good' }));
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, 'step');
  assert.deepEqual(out[0].patch, { step: 2 });
  assert.match(out[0].text, /шаг 1/);
});

test('no step suggestion when one of last 3 is not good', () => {
  const t = mk('x', { status: 'learning', step: 1 }, 3);
  const s = [
    ...days([1, 2], { trick: 'x', block: 'new', step: 1, result: 'good' }),
    ...days([3], { trick: 'x', block: 'new', step: 1, result: 'ok' }),
  ];
  assert.deepEqual(suggestionsFor(t, s), []);
});

test('good results on another step do not count', () => {
  const t = mk('x', { status: 'learning', step: 2 }, 3);
  assert.deepEqual(suggestionsFor(t, days([1, 2, 3], { trick: 'x', block: 'new', step: 1, result: 'good' })), []);
});

test('promote to reinforcing after the last step', () => {
  const t = mk('x', { status: 'learning', step: 3 }, 3);
  const out = suggestionsFor(t, days([1, 2, 3], { trick: 'x', block: 'new', step: 3, result: 'good' }));
  assert.equal(out[0].kind, 'promote');
  assert.deepEqual(out[0].patch, { status: 'reinforcing', reliability: 'home' });
});

test('project uses the word "уровень"', () => {
  const t = mk('p', { type: 'project', status: 'learning', step: 1 }, 4);
  const out = suggestionsFor(t, days([1, 2, 3], { trick: 'p', block: 'new', step: 1, result: 'good' }));
  assert.match(out[0].text, /уровень 1/);
});

test('reinforcing → known: good on 3 days within a week and no bad', () => {
  const t = mk('x', { status: 'reinforcing', reliability: 'home' });
  const now = new Date(2026, 10, 8, 12);
  const out = suggestionsFor(t, days([4, 5, 7], { trick: 'x', block: 'repeat', result: 'good' }), now);
  assert.equal(out[0].kind, 'known');
  assert.deepEqual(out[0].patch, { status: 'known', known_since: '2026-11-08' });
});

test('reinforcing → known blocked by a bad result this week', () => {
  const t = mk('x', { status: 'reinforcing', reliability: 'home' });
  const s = [...days([4, 5, 7], { trick: 'x', block: 'repeat', result: 'good' }), ...days([8], { trick: 'x', block: 'repeat', result: 'bad' })];
  assert.equal(suggestionsFor(t, s, new Date(2026, 10, 8, 12)).filter((x) => x.kind === 'known').length, 0);
});

test('learning-phase results do not count toward known', () => {
  const t = mk('x', { status: 'reinforcing', reliability: 'home' });
  const out = suggestionsFor(t, days([4, 5, 7], { trick: 'x', block: 'new', step: 3, result: 'good' }), new Date(2026, 10, 8, 12));
  assert.deepEqual(out, []);
});

test('demote known after two bad in a row', () => {
  const t = mk('x', { status: 'known', reliability: 'yard' });
  const out = suggestionsFor(t, days([1, 2], { trick: 'x', block: 'repeat', result: 'bad' }));
  assert.equal(out[0].kind, 'demote');
  assert.deepEqual(out[0].patch, { status: 'reinforcing' });
});

test('suggest reliability level up after 3 outdoor good at target level', () => {
  const t = mk('x', { status: 'known', reliability: 'yard' });
  const out = suggestionsFor(t, days([1, 2, 3], { trick: 'x', block: 'repeat', level: 'park', result: 'good' }, 'outdoor'));
  assert.equal(out[0].kind, 'level');
  assert.deepEqual(out[0].patch, { reliability: 'park' });
});

test('allSuggestions gives each suggestion a stable key', () => {
  const t = mk('x', { status: 'known', reliability: 'yard' });
  const out = allSuggestions([t], days([1, 2], { trick: 'x', block: 'repeat', result: 'bad' }));
  assert.equal(out[0].key, 'x:demote:known:1:yard');
});

test('learning limit counts only tricks that share a place', () => {
  const tricks = [
    mk('out1', { status: 'learning', place: 'outdoor' }),
    mk('out2', { status: 'learning', place: 'outdoor' }),
    mk('anyl', { status: 'learning', place: 'any' }),
    mk('home1', { status: 'want', place: 'home' }),
  ];
  assert.deepEqual(learningConflicts(tricks, 'home1', 'home').map((t) => t.slug), ['anyl']);
  assert.deepEqual(learningConflicts(tricks, 'x', 'outdoor').map((t) => t.slug), ['out1', 'out2', 'anyl']);
  assert.deepEqual(learningConflicts(tricks, 'out1', 'any').map((t) => t.slug), ['out2', 'anyl']);
});
