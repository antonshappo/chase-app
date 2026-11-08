import { esc } from '../core/md.js';
import { STATUS } from '../core/labels.js';
import { trickPath } from '../core/trick.js';
import { dayKey, localIso } from '../core/log.js';
import { learningConflicts } from '../core/rules.js';

function storageGet(kind, key, fallback) {
  try {
    const raw = globalThis[kind].getItem(key);
    return raw == null ? fallback : JSON.parse(raw) ?? fallback;
  } catch {
    return fallback;
  }
}

function storageSet(kind, key, value) {
  try {
    if (value == null) globalThis[kind].removeItem(key);
    else globalThis[kind].setItem(key, JSON.stringify(value));
  } catch {
    /* приватный режим или хранилище недоступно */
  }
}

export const lsGet = (k, d) => storageGet('localStorage', k, d);
export const lsSet = (k, v) => storageSet('localStorage', k, v);
export const ssGet = (k, d) => storageGet('sessionStorage', k, d);
export const ssSet = (k, v) => storageSet('sessionStorage', k, v);

export const today = () => dayKey(localIso());

export const trickName = (app, slug) => app.model.bySlug.get(slug)?.meta.name || slug;

export function options(map, current) {
  return Object.entries(map)
    .map(([v, l]) => `<option value="${esc(v)}"${v === current ? ' selected' : ''}>${esc(l)}</option>`)
    .join('');
}

export const statusBadge = (s) => `<span class="badge st-${esc(s)}">${STATUS[s] || esc(s)}</span>`;

export const setMeta = (app, slug, patch) => app.dispatch({ type: 'meta', path: trickPath(slug), patch });

export function confirmLearning(app, slug, { name, place } = {}) {
  const t = app.model.bySlug.get(slug);
  const where = place || t?.meta.place || 'any';
  const others = learningConflicts(app.model.tricks, slug, where);
  const limit = app.model.settings.learningLimit || 2;
  if (others.length < limit) return true;
  const list = others.map((x) => `«${x.meta.name}»`).join(', ');
  const scope = where === 'home' ? ' для дома' : where === 'outdoor' ? ' для улицы' : '';
  return globalThis.confirm(`${scope ? `Сейчас${scope}` : 'Сейчас'} уже учите ${others.length}: ${list}. Лучше не больше ${limit} одновременно. Всё равно добавить «${name || trickName(app, slug)}»?`);
}

// Короткое подтверждение внизу экрана. Если сети нет — честно говорим, что отправится позже.
export function saved(app, msg, action) {
  const offline = app.status?.state === 'offline' || globalThis.navigator?.onLine === false;
  app.toast?.(offline ? `${msg} · отправится, когда появится сеть` : msg, { action });
}

export const info = (app, msg) => app.toast?.(msg, { icon: 'ℹ️' });

// Перевести в «Учим» с кнопкой «Отменить» во всплывающем сообщении.
export async function startLearning(app, slug, after = () => {}) {
  const t = app.model.bySlug.get(slug);
  if (!t || !confirmLearning(app, slug)) return false;
  const prev = { status: t.meta.status, step: t.meta.step };
  await setMeta(app, slug, { status: 'learning', step: 1 });
  after();
  saved(app, `«${t.meta.name}» — в «Учим»`, {
    label: 'Отменить',
    fn: async () => {
      await setMeta(app, slug, prev);
      after();
      info(app, 'Отменено');
    },
  });
  return true;
}

export function visibleSuggestions(list) {
  const dismissed = new Set(lsGet('chase.dismissed', []));
  return list.filter((s) => !dismissed.has(s.key));
}

export function suggestionsBlock(list) {
  if (!list.length) return '';
  return `<section class="suggest"><h3>Подсказки</h3>${list.map((s) => `<div class="suggest-item">
    <p>${esc(s.text)}</p>
    <div class="row">
      <button class="btn small primary" data-act="sugApply" data-slug="${esc(s.slug)}" data-patch="${esc(JSON.stringify(s.patch))}">Да</button>
      <button class="btn small ghost" data-act="sugDismiss" data-key="${esc(s.key)}">Не сейчас</button>
    </div></div>`).join('')}</section>`;
}
