import { parseTrick } from './trick.js';
import { parseLogs } from './log.js';

export const DEFAULT_SETTINGS = { props: [], learningLimit: 2 };

export function buildModel(view) {
  const tricks = [];
  for (const [path, text] of view) {
    const m = path.match(/^tricks\/([^/]+)\/trick\.md$/);
    if (m) tricks.push(parseTrick(m[1], text));
  }
  tricks.sort((a, b) => a.meta.name.localeCompare(b.meta.name, 'ru'));
  let settings = { ...DEFAULT_SETTINGS };
  if (view.has('settings.json')) {
    try {
      settings = { ...DEFAULT_SETTINGS, ...JSON.parse(view.get('settings.json')) };
    } catch {
      /* битые настройки → значения по умолчанию */
    }
  }
  return { tricks, sessions: parseLogs(view), settings, bySlug: new Map(tricks.map((t) => [t.slug, t])) };
}
