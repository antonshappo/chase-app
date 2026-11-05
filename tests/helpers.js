import { parseTrick, newTrickText } from '../js/core/trick.js';

export function mk(slug, meta = {}, steps = 0) {
  let text = newTrickText({ name: slug, type: 'trick', status: 'known', place: 'any', ...meta });
  if (steps) {
    text += `\n## Шаги\n\n${Array.from({ length: steps }, (_, i) => `### ${i + 1}. s${i + 1}\nтекст\n`).join('\n')}`;
  }
  return parseTrick(slug, text);
}

export const seeded = (seed = 42) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

export const sess = (id, items, place = 'home') => ({ id, place, minutes: 20, items });
