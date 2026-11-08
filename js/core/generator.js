import { lastPracticed } from './log.js';
import { nextLevel } from './rules.js';

export const PLAN = {
  10: { warmup: 2, repeat: 2, game: false },
  20: { warmup: 3, repeat: 4, game: true },
  30: { warmup: 3, repeat: 5, game: true },
};

export function shuffle(list, rng = Math.random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function eligible(t, place, props) {
  if (t.error || t.meta.in_plan === false) return false;
  const p = t.meta.place;
  if (place !== 'any' && p !== 'any' && p !== place) return false;
  const have = new Set([...(props || []), 'treats']);
  return t.meta.props.every((x) => have.has(x));
}

const isKnownTrick = (t) => t.meta.type === 'trick' && t.meta.status === 'known';
const isRepeatable = (t) => t.meta.type !== 'game' && (t.meta.status === 'known' || t.meta.status === 'reinforcing');
const isLearning = (t) => t.meta.type !== 'game' && t.meta.status === 'learning';
const isGame = (t) => t.meta.type === 'game';

function repeatCard(t, place) {
  const card = { block: 'repeat', slugs: [t.slug] };
  if (place === 'outdoor') {
    const lvl = nextLevel(t.meta.reliability);
    if (lvl) card.tryLevel = lvl;
  }
  return card;
}

const newCard = (t) => ({ block: 'new', slugs: [t.slug], step: t.meta.step });

export function buildSession({ tricks, sessions = [], place, minutes = 20, props = [], rng = Math.random }) {
  const cfg = PLAN[minutes] || PLAN[20];
  const last = lastPracticed(sessions);
  const age = (t) => last.get(t.slug) || '';
  const oldestFirst = (list) => shuffle(list, rng).sort((a, b) => age(a).localeCompare(age(b)));
  const pool = tricks.filter((t) => eligible(t, place, props));
  const used = new Set();
  const take = (list, n) => {
    const r = list.filter((t) => !used.has(t.slug)).slice(0, n);
    r.forEach((t) => used.add(t.slug));
    return r;
  };
  const cards = [];

  const learning = take(oldestFirst(pool.filter(isLearning)), 1);
  const warm = take(shuffle(pool.filter(isKnownTrick), rng), cfg.warmup);
  if (warm.length) cards.push({ block: 'warmup', slugs: warm.map((t) => t.slug) });

  if (learning.length) {
    cards.push(newCard(learning[0]));
  } else {
    const options = pool.filter((t) => t.meta.status === 'want' && t.meta.type !== 'game').map((t) => t.slug);
    if (options.length) cards.push({ block: 'pick', slugs: [], options });
  }

  const chainPool = pool.filter((t) => isKnownTrick(t) && !used.has(t.slug));
  if (sessions.length % 3 === 2 && chainPool.length >= 3) {
    const n = Math.min(chainPool.length, 3 + Math.floor(rng() * 3));
    cards.push({ block: 'chain', slugs: take(shuffle(chainPool, rng), n).map((t) => t.slug) });
  } else {
    const rep = oldestFirst(pool.filter(isRepeatable))
      .sort((a, b) => (b.meta.status === 'reinforcing') - (a.meta.status === 'reinforcing'));
    for (const t of take(rep, cfg.repeat)) cards.push(repeatCard(t, place));
  }

  if (cfg.game) {
    const g = take(oldestFirst(pool.filter(isGame)), 1);
    if (g.length) cards.push({ block: 'game', slugs: [g[0].slug] });
  }

  let fin = take(shuffle(pool.filter((t) => isKnownTrick(t) && t.meta.favorite), rng), 1);
  if (!fin.length) fin = take(shuffle(pool.filter(isKnownTrick), rng), 1);
  if (fin.length) cards.push({ block: 'finale', slugs: [fin[0].slug] });

  return { place, minutes, cards };
}

export function swapCard(plan, index, { tricks, props = [], rng = Math.random }) {
  const card = plan.cards[index];
  const inPlan = new Set(plan.cards.flatMap((c) => c.slugs));
  const pool = shuffle(tricks.filter((t) => eligible(t, plan.place, props) && !inPlan.has(t.slug)), rng);
  let next = null;
  switch (card.block) {
    case 'warmup':
    case 'chain': {
      const picks = pool.filter(isKnownTrick).slice(0, card.slugs.length);
      if (picks.length === card.slugs.length) next = { ...card, slugs: picks.map((t) => t.slug) };
      break;
    }
    case 'repeat': {
      const t = pool.find(isRepeatable);
      if (t) next = repeatCard(t, plan.place);
      break;
    }
    case 'new': {
      const t = pool.find(isLearning);
      if (t) next = newCard(t);
      break;
    }
    case 'game': {
      const t = pool.find(isGame);
      if (t) next = { block: 'game', slugs: [t.slug] };
      break;
    }
    case 'finale': {
      const t = pool.find(isKnownTrick);
      if (t) next = { block: 'finale', slugs: [t.slug] };
      break;
    }
    default:
      break;
  }
  if (!next) return plan;
  const cards = plan.cards.slice();
  cards[index] = next;
  return { ...plan, cards };
}

export function singleSession(t) {
  const place = t.meta.place === 'outdoor' ? 'outdoor' : 'home';
  let card;
  if (isGame(t)) card = { block: 'game', slugs: [t.slug] };
  else if (t.meta.status === 'learning') card = newCard(t);
  else card = repeatCard(t, place);
  return { place, minutes: null, cards: [card] };
}
