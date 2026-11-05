import { localIso, monthKey, dayKey } from './log.js';
import { STATUSES } from './trick.js';

export function progressStats(tricks, sessions, now = new Date()) {
  const month = monthKey(localIso(now));
  const weekAgo = localIso(new Date(now.getTime() - 7 * 864e5));
  const inMonth = sessions.filter((s) => monthKey(s.id) === month);
  const notGame = tricks.filter((t) => t.meta.type !== 'game');
  return {
    week: sessions.filter((s) => s.id >= weekAgo).length,
    month: inMonth.length,
    days: new Set(inMonth.map((s) => dayKey(s.id))),
    learnedThisMonth: notGame.filter((t) => t.meta.known_since && monthKey(t.meta.known_since) === month),
    counts: Object.fromEntries(STATUSES.map((st) => [st, notGame.filter((t) => t.meta.status === st).length])),
    learning: tricks.filter((t) => t.meta.status === 'learning'),
    monthKey: month,
  };
}
