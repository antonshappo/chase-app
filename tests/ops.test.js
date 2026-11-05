import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyOp, applyQueue } from '../js/core/ops.js';
import { newTrickText, parseTrick } from '../js/core/trick.js';

const P = 'tricks/a/trick.md';
const A = newTrickText({ name: 'А', status: 'want' });

test('meta op patches frontmatter', () => {
  assert.equal(parseTrick('a', applyOp(A, { type: 'meta', path: P, patch: { status: 'learning' } })).meta.status, 'learning');
});

test('meta op on missing file throws', () => {
  assert.throws(() => applyOp(null, { type: 'meta', path: P, patch: {} }));
});

test('link and notes ops', () => {
  let t = applyOp(A, { type: 'link', path: P, link: { url: 'https://youtu.be/1', note: 'тут' } });
  t = applyOp(t, { type: 'notes', path: P, notes: 'заметка' });
  const tr = parseTrick('a', t);
  assert.equal(tr.links[0].url, 'https://youtu.be/1');
  assert.equal(tr.notes, 'заметка');
});

test('create op does not overwrite an existing file', () => {
  assert.equal(applyOp('old', { type: 'create', path: P, text: 'new' }), 'old');
  assert.equal(applyOp(null, { type: 'create', path: P, text: 'new' }), 'new');
});

test('session op appends once and keeps order', () => {
  const s1 = { id: '2026-11-05T10:00:00', items: [] };
  const s0 = { id: '2026-11-01T10:00:00', items: [] };
  let t = applyOp(null, { type: 'session', path: 'log/2026-11.json', session: s1 });
  t = applyOp(t, { type: 'session', path: 'log/2026-11.json', session: s0 });
  t = applyOp(t, { type: 'session', path: 'log/2026-11.json', session: s1 });
  assert.deepEqual(JSON.parse(t).map((s) => s.id), [s0.id, s1.id]);
});

test('settings op merges json', () => {
  const t = applyOp('{"props":["toy"],"learningLimit":2}', { type: 'settings', path: 'settings.json', patch: { props: ['ball'] } });
  assert.deepEqual(JSON.parse(t), { props: ['ball'], learningLimit: 2 });
});

test('applyQueue applies ops in order and skips broken ones', () => {
  const files = new Map([[P, { sha: '1', text: A }]]);
  const view = applyQueue(files, [
    { id: 1, op: { type: 'meta', path: 'tricks/missing/trick.md', patch: { step: 2 } } },
    { id: 2, op: { type: 'meta', path: P, patch: { status: 'learning' } } },
    { id: 3, op: { type: 'meta', path: P, patch: { step: 3 } } },
  ]);
  const t = parseTrick('a', view.get(P));
  assert.equal(t.meta.status, 'learning');
  assert.equal(t.meta.step, 3);
  assert.equal(view.has('tricks/missing/trick.md'), false);
});
