import { RELIABILITY } from './trick.js';
import { entriesFor, dayKey, localIso } from './log.js';
import { LEVEL } from './labels.js';

export function nextLevel(rel) {
  const i = RELIABILITY.indexOf(rel || 'home');
  return i >= 0 && i < RELIABILITY.length - 1 ? RELIABILITY[i + 1] : null;
}

export const placesOverlap = (a, b) => a === 'any' || b === 'any' || a === b;

// Лимит «Учим» считается отдельно для дома и для улицы: мешают только те, что делаются там же.
export function learningConflicts(tricks, slug, place) {
  return tricks.filter((t) => t.meta.status === 'learning' && t.slug !== slug && placesOverlap(t.meta.place, place));
}

export function suggestionsFor(t, sessions, now = new Date()) {
  const m = t.meta;
  const e = entriesFor(t.slug, sessions).filter((x) => x.result);
  const out = [];
  const add = (kind, text, patch) => out.push({
    slug: t.slug, kind, key: `${t.slug}:${kind}:${m.status}:${m.step}:${m.reliability}`, text, patch,
  });
  const word = m.type === 'project' ? 'уровень' : 'шаг';

  if (m.status === 'learning' && m.type !== 'game') {
    const last3 = e.filter((x) => x.block === 'new' && x.step === m.step).slice(-3);
    if (last3.length === 3 && last3.every((x) => x.result === 'good')) {
      if (m.step < t.steps.length) {
        add('step', `«${m.name}»: ${word} ${m.step} освоен. Перейти к следующему?`, { step: m.step + 1 });
      } else {
        add('promote', `«${m.name}»: всё освоено. Перевести в «Закрепляем»?`, { status: 'reinforcing', reliability: m.reliability || 'home' });
      }
    }
  }

  if (m.status === 'reinforcing') {
    const since = localIso(new Date(now.getTime() - 7 * 864e5));
    const recent = e.filter((x) => x.block !== 'new' && x.date >= since);
    const goodDays = new Set(recent.filter((x) => x.result === 'good').map((x) => dayKey(x.date)));
    if (goodDays.size >= 3 && !recent.some((x) => x.result === 'bad')) {
      add('known', `«${m.name}» стабильно получается. Перевести в «Знает»?`, { status: 'known', known_since: dayKey(localIso(now)) });
    }
  }

  if (m.status === 'known') {
    const last2 = e.slice(-2);
    if (last2.length === 2 && last2.every((x) => x.result === 'bad')) {
      add('demote', `Похоже, «${m.name}» подзабылась. Вернуть в «Закрепляем»?`, { status: 'reinforcing' });
    }
  }

  if ((m.status === 'known' || m.status === 'reinforcing') && m.type !== 'game') {
    const target = nextLevel(m.reliability);
    const tries = e.filter((x) => x.place === 'outdoor' && x.level === target).slice(-3);
    if (target && tries.length === 3 && tries.every((x) => x.result === 'good')) {
      add('level', `«${m.name}» уверенно получается: ${LEVEL[target]}. Поднять надёжность?`, { reliability: target });
    }
  }
  return out;
}

export const allSuggestions = (tricks, sessions, now) => tricks.flatMap((t) => suggestionsFor(t, sessions, now));
