import { STATUS, TYPE, PLACE, PROPS, stepWord } from '../../core/labels.js';
import { esc } from '../../core/md.js';
import { options, statusBadge } from '../helpers.js';

// Фильтры живут только в памяти: после перезапуска библиотека снова показывает всё.
const EMPTY = { q: '', place: '', status: '', type: '', props: [] };
const FILTER_PROPS = Object.fromEntries(Object.entries(PROPS).filter(([k]) => k !== 'treats'));

const filters = (app) => ({ ...EMPTY, ...(app.ui.lib || {}) });
const isActive = (f) => Boolean(f.q || f.place || f.status || f.type || f.props.length);

export function filterTricks(tricks, f) {
  const q = (f.q || '').toLowerCase().trim();
  const props = f.props || [];
  return tricks.filter((t) => (!q || `${t.meta.name} ${t.meta.commands.join(' ')}`.toLowerCase().includes(q))
    && (!f.place || t.meta.place === f.place || t.meta.place === 'any')
    && (!f.status || t.meta.status === f.status)
    && (!f.type || t.meta.type === f.type)
    && (!props.length || props.some((p) => t.meta.props.includes(p))));
}

function propsFilter(app, f) {
  const label = f.props.length ? f.props.map((p) => esc(PROPS[p] || p)).join(', ') : 'все';
  return `<details class="multi${f.props.length ? ' active' : ''}"${app.ui.libPropsOpen ? ' open' : ''}>
    <summary>Реквизит: ${label}</summary>
    <div class="multi-list">${Object.entries(FILTER_PROPS).map(([k, l]) => `<label class="check"><input type="checkbox" data-change="libProp" value="${k}"${f.props.includes(k) ? ' checked' : ''}> ${esc(l)}</label>`).join('')}</div>
  </details>`;
}

export function view(app) {
  const f = filters(app);
  const list = filterTricks(app.model.tricks, f);
  const sel = (key, map, label) => `<select class="${f[key] ? 'active' : ''}" data-change="libFilter" data-k="${key}" aria-label="${label}"><option value="">${label}: все</option>${options(map, f[key])}</select>`;
  const row = (t) => {
    const step = t.meta.status === 'learning' && t.meta.type !== 'game'
      ? ` · ${stepWord(t)} ${t.meta.step}${t.steps.length ? `/${t.steps.length}` : ''}` : '';
    return `<li><a href="#/trick/${encodeURIComponent(t.slug)}">
      <span class="lib-name">${esc(t.meta.name)}${t.error ? ' ⚠️' : ''}${t.meta.needs_method ? ' <span class="muted small">· нужна методика</span>' : ''}</span>
      <span class="lib-meta">${t.meta.type === 'game' ? '' : `${statusBadge(t.meta.status)} `}<span class="muted small">${TYPE[t.meta.type] || ''} · ${PLACE[t.meta.place] || ''}${step}</span></span>
    </a></li>`;
  };
  const total = app.model.tricks.length;
  return `<section class="card">
    <h1>Библиотека <span class="muted">${isActive(f) ? `${list.length} из ${total}` : total}</span></h1>
    <input type="search" class="search${f.q ? ' active' : ''}" placeholder="Поиск по названию или команде" value="${esc(f.q)}" data-change="libFilter" data-k="q">
    <div class="filters">${sel('place', { home: PLACE.home, outdoor: PLACE.outdoor }, 'Где')}${sel('status', STATUS, 'Статус')}${sel('type', TYPE, 'Тип')}</div>
    ${propsFilter(app, f)}
    ${isActive(f) ? '<button class="btn small ghost reset" data-act="libReset">✕ Сбросить фильтры</button>' : ''}
  </section>
  <ul class="lib">${list.map(row).join('')}</ul>
  ${list.length ? '' : `<p class="muted">Ничего не найдено.${isActive(f) ? ' Попробуй сбросить фильтры.' : ''}</p>`}`;
}

export const actions = {
  libFilter(app, el) {
    app.ui.lib = { ...filters(app), [el.dataset.k]: el.value };
    app.ui.libPropsOpen = false;
    app.render(true);
  },
  libProp(app, el) {
    const f = filters(app);
    const props = el.checked ? [...new Set([...f.props, el.value])] : f.props.filter((p) => p !== el.value);
    app.ui.lib = { ...f, props };
    app.ui.libPropsOpen = true;
    app.render(true);
  },
  libReset(app) {
    app.ui.lib = { ...EMPTY };
    app.ui.libPropsOpen = false;
    app.render(true);
  },
};
