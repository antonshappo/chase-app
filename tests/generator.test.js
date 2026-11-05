import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSession, swapCard, singleSession, eligible } from '../js/core/generator.js';
import { mk, seeded, sess } from './helpers.js';

const base = () => [
  ...['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((s) => mk(s)),
  mk('fav', { favorite: true }),
  mk('fu', { in_plan: false }),
  mk('learn', { status: 'learning', step: 2 }, 3),
  mk('reinf', { status: 'reinforcing', reliability: 'yard' }),
  mk('game-home', { type: 'game', place: 'home' }),
  mk('game-out', { type: 'game', place: 'outdoor' }),
  mk('out-only', { place: 'outdoor' }),
  mk('frisbee', { place: 'outdoor', props: ['frisbee'] }),
  mk('wish', { status: 'want' }),
];
const slugsOf = (p) => p.cards.flatMap((c) => c.slugs);

test('eligible checks place, props and in_plan', () => {
  const [frisbee] = base().filter((t) => t.slug === 'frisbee');
  assert.equal(eligible(frisbee, 'outdoor', []), false);
  assert.equal(eligible(frisbee, 'outdoor', ['frisbee']), true);
  assert.equal(eligible(frisbee, 'home', ['frisbee']), false);
  assert.equal(eligible(mk('t', { props: ['treats'] }), 'home', []), true);
  assert.equal(eligible(mk('fu', { in_plan: false }), 'home', []), false);
});

test('20-min home session: blocks in order', () => {
  const p = buildSession({ tricks: base(), sessions: [], place: 'home', minutes: 20, props: [], rng: seeded() });
  assert.deepEqual(p.cards.map((c) => c.block), ['warmup', 'new', 'repeat', 'repeat', 'repeat', 'repeat', 'game', 'finale']);
  assert.equal(p.cards[0].slugs.length, 3);
  assert.deepEqual(p.cards[1], { block: 'new', slugs: ['learn'], step: 2 });
  assert.equal(p.cards[2].slugs[0], 'reinf');
  assert.deepEqual(p.cards[6].slugs, ['game-home']);
});

test('never repeats a trick and respects place/props/in_plan', () => {
  for (let seed = 1; seed < 30; seed++) {
    const p = buildSession({ tricks: base(), sessions: [], place: 'home', minutes: 30, props: [], rng: seeded(seed) });
    const s = slugsOf(p);
    assert.equal(new Set(s).size, s.length);
    for (const bad of ['out-only', 'frisbee', 'game-out', 'fu', 'wish']) assert.ok(!s.includes(bad), `${bad} in seed ${seed}`);
  }
});

test('finale prefers a favorite when it is still free', () => {
  for (let seed = 1; seed < 20; seed++) {
    const p = buildSession({ tricks: base(), sessions: [], place: 'home', minutes: 10, props: [], rng: seeded(seed) });
    const fin = p.cards[p.cards.length - 1];
    const before = p.cards.slice(0, -1).flatMap((c) => c.slugs);
    assert.equal(fin.block, 'finale');
    if (!before.includes('fav')) assert.deepEqual(fin.slugs, ['fav']);
  }
});

test('10-min session has no game and 2 repeats', () => {
  const p = buildSession({ tricks: base(), sessions: [], place: 'home', minutes: 10, props: [], rng: seeded() });
  assert.equal(p.cards.filter((c) => c.block === 'game').length, 0);
  assert.equal(p.cards.filter((c) => c.block === 'repeat').length, 2);
});

test('repeat prefers least recently practiced', () => {
  const tricks = ['p1', 'p2', 'p3'].map((s) => mk(s, { type: 'project' }));
  const sessions = [
    sess('2026-11-01T10:00:00', [{ trick: 'p1', block: 'repeat', result: 'good' }]),
    sess('2026-11-03T10:00:00', [{ trick: 'p2', block: 'repeat', result: 'good' }]),
  ];
  const p = buildSession({ tricks, sessions, place: 'home', minutes: 10, props: [], rng: seeded() });
  assert.deepEqual(p.cards.map((c) => c.slugs[0]), ['p3', 'p1']);
});

test('no learning → pick card with want options', () => {
  const tricks = base().filter((t) => t.slug !== 'learn');
  const p = buildSession({ tricks, sessions: [], place: 'home', minutes: 20, props: [], rng: seeded() });
  assert.deepEqual(p.cards[1], { block: 'pick', slugs: [], options: ['wish'] });
});

test('every third session uses a chain instead of repeats', () => {
  const sessions = [sess('2026-11-01T10:00:00', []), sess('2026-11-02T10:00:00', [])];
  const p = buildSession({ tricks: base(), sessions, place: 'home', minutes: 20, props: [], rng: seeded() });
  const chain = p.cards.find((c) => c.block === 'chain');
  assert.ok(chain);
  assert.ok(chain.slugs.length >= 3 && chain.slugs.length <= 5);
  assert.equal(p.cards.filter((c) => c.block === 'repeat').length, 0);
});

test('outdoor repeat card suggests the next reliability level', () => {
  const p = buildSession({ tricks: base(), sessions: [], place: 'outdoor', minutes: 20, props: [], rng: seeded() });
  const card = p.cards.find((c) => c.slugs[0] === 'reinf');
  assert.equal(card.tryLevel, 'park');
});

test('swapCard replaces a card with a trick not in the plan', () => {
  const tricks = base();
  const p = buildSession({ tricks, sessions: [], place: 'home', minutes: 20, props: [], rng: seeded() });
  const i = p.cards.findIndex((c) => c.block === 'repeat');
  const q = swapCard(p, i, { tricks, props: [], rng: seeded(7) });
  assert.notDeepEqual(q.cards[i].slugs, p.cards[i].slugs);
  assert.ok(!slugsOf(p).includes(q.cards[i].slugs[0]));
  assert.equal(q.cards[i].block, 'repeat');
});

test('swapCard returns the same plan when nothing is left', () => {
  const tricks = base();
  const p = buildSession({ tricks, sessions: [], place: 'home', minutes: 20, props: [], rng: seeded() });
  const i = p.cards.findIndex((c) => c.block === 'game');
  assert.equal(swapCard(p, i, { tricks, props: [], rng: seeded() }), p);
});

test('singleSession builds one card by status', () => {
  assert.deepEqual(singleSession(mk('l', { status: 'learning', step: 2 }, 3)).cards, [{ block: 'new', slugs: ['l'], step: 2 }]);
  assert.deepEqual(singleSession(mk('g', { type: 'game', place: 'outdoor' })), { place: 'outdoor', minutes: null, cards: [{ block: 'game', slugs: ['g'] }] });
  assert.deepEqual(singleSession(mk('k')).cards, [{ block: 'repeat', slugs: ['k'] }]);
});
