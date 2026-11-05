import { STATUS, TYPE, PLACE, PROPS, stepWord } from '../../core/labels.js';
import { esc } from '../../core/md.js';
import { lsGet, lsSet, options, statusBadge } from '../helpers.js';

const KEY = 'chase.lib';
const filters = () => lsGet(KEY, { q: '', place: '', status: '', type: '', prop: '' });

export function filterTricks(tricks, f) {
  const q = (f.q || '').toLowerCase().trim();
  return tricks.filter((t) => (!q || `${t.meta.name} ${t.meta.commands.join(' ')}`.toLowerCase().includes(q))
    && (!f.place || t.meta.place === f.place || t.meta.place === 'any')
    && (!f.status || t.meta.status === f.status)
    && (!f.type || t.meta.type === f.type)
    && (!f.prop || t.meta.props.includes(f.prop)));
}

export function view(app) {
  const f = filters();
  const list = filterTricks(app.model.tricks, f);
  const sel = (key, map, label) => `<select data-change="libFilter" data-k="${key}" aria-label="${label}"><option value="">${label}: все</option>${options(map, f[key])}</select>`;
  const row = (t) => {
    const step = t.meta.status === 'learning' && t.meta.type !== 'game'
      ? ` · ${stepWord(t)} ${t.meta.step}${t.steps.length ? `/${t.steps.length}` : ''}` : '';
    return `<li><a href="#/trick/${encodeURIComponent(t.slug)}">
      <span class="lib-name">${esc(t.meta.name)}${t.error ? ' ⚠️' : ''}${t.meta.needs_method ? ' <span class="muted small">· нужна методика</span>' : ''}</span>
      <span class="lib-meta">${t.meta.type === 'game' ? '' : `${statusBadge(t.meta.status)} `}<span class="muted small">${TYPE[t.meta.type] || ''} · ${PLACE[t.meta.place] || ''}${step}</span></span>
    </a></li>`;
  };
  return `<section class="card">
    <h1>Библиотека <span class="muted">${list.length}</span></h1>
    <input type="search" class="search" placeholder="Поиск по названию или команде" value="${esc(f.q)}" data-change="libFilter" data-k="q">
    <div class="filters">${sel('place', { home: PLACE.home, outdoor: PLACE.outdoor }, 'Где')}${sel('status', STATUS, 'Статус')}${sel('type', TYPE, 'Тип')}${sel('prop', PROPS, 'Реквизит')}</div>
  </section>
  <ul class="lib">${list.map(row).join('')}</ul>
  ${list.length ? '' : '<p class="muted">Ничего не найдено.</p>'}`;
}

export const actions = {
  libFilter(app, el) {
    lsSet(KEY, { ...filters(), [el.dataset.k]: el.value });
    app.render(true);
  },
};
