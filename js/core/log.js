const pad = (n) => String(n).padStart(2, '0');

export function localIso(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export const dayKey = (iso) => String(iso).slice(0, 10);
export const monthKey = (iso) => String(iso).slice(0, 7);
export const logPath = (iso) => `log/${monthKey(iso)}.json`;
export const LOG_RE = /^log\/\d{4}-\d{2}\.json$/;

export function parseLogs(view) {
  const all = [];
  for (const [path, text] of view) {
    if (!LOG_RE.test(path)) continue;
    try {
      const list = JSON.parse(text);
      if (Array.isArray(list)) all.push(...list);
    } catch {
      /* битый файл журнала пропускаем */
    }
  }
  return all
    .filter((s) => s && typeof s.id === 'string' && Array.isArray(s.items))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function entriesFor(slug, sessions) {
  const out = [];
  for (const s of sessions) {
    for (const it of s.items) {
      if (it.trick !== slug) continue;
      out.push({
        date: s.id, place: s.place, block: it.block, step: it.step ?? null, level: it.level ?? null, result: it.result ?? null,
      });
    }
  }
  return out;
}

export function lastPracticed(sessions) {
  const map = new Map();
  for (const s of sessions) {
    for (const it of s.items) {
      if (!map.has(it.trick) || map.get(it.trick) < s.id) map.set(it.trick, s.id);
    }
  }
  return map;
}
