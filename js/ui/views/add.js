import { PLACE, PROPS, STATUS, TYPE, TYPE_HINT } from '../../core/labels.js';
import { esc } from '../../core/md.js';
import { newTrickText, trickPath, uniqueSlug, linkTitle } from '../../core/trick.js';
import { options, ssGet, ssSet, confirmLearning, today, saved } from '../helpers.js';

export function view(app) {
  const mode = app.ui.addMode || 'link';
  const shared = ssGet('chase.share', '');
  const msg = app.ui.addMsg ? `<p class="ok">✓ ${esc(app.ui.addMsg)}</p>` : '';
  const linkForm = `<form data-submit="addLink" class="stack">
    <label>Ссылка<input name="url" type="url" required value="${esc(shared)}" placeholder="https://instagram.com/…"></label>
    <label>К какому трюку<select name="slug" required>
      <option value="">Выбери…</option>
      <option value="__new">➕ Новый трюк</option>
      ${app.model.tricks.map((t) => `<option value="${esc(t.slug)}">${esc(t.meta.name)}</option>`).join('')}
    </select></label>
    <label>Название, если трюк новый<input name="newName" placeholder="Например: Обними"></label>
    <label>Подпись (необязательно)<input name="note" placeholder="Что тут полезного"></label>
    <button class="btn primary big">Сохранить ссылку</button>
  </form>`;
  const trickForm = `<form data-submit="addTrick" class="stack">
    <label>Название<input name="name" required></label>
    <label>Команда (через запятую)<input name="commands" placeholder="Обними"></label>
    <label>Тип<select name="type">${options(TYPE, 'trick')}</select></label>
    <ul class="hint-text type-hints">${Object.entries(TYPE).map(([k, l]) => `<li><b>${l}</b> — ${TYPE_HINT[k]}</li>`).join('')}</ul>
    <label>Где<select name="place">${options(PLACE, 'any')}</select></label>
    <label>Статус<select name="status">${options(STATUS, 'want')}</select></label>
    <fieldset class="props"><legend class="muted small">Реквизит</legend>${Object.entries(PROPS).map(([k, l]) => `<label class="check"><input type="checkbox" name="props" value="${k}"> ${esc(l)}</label>`).join('')}</fieldset>
    <button class="btn primary big">Добавить</button>
  </form>`;
  return `<section class="card">
    <h1>Добавить</h1>
    <div class="seg">${[['link', '🔗 Ссылка'], ['trick', '🐾 Трюк / игра']].map(([k, l]) => `<button class="${mode === k ? 'on' : ''}" data-act="addMode" data-v="${k}">${l}</button>`).join('')}</div>
    ${msg}${mode === 'link' ? linkForm : trickForm}
  </section>`;
}

function createTrick(app, meta) {
  const slug = uniqueSlug(meta.name, new Set(app.model.tricks.map((t) => t.slug)));
  return { slug, op: { type: 'create', path: trickPath(slug), text: newTrickText(meta) } };
}

export const actions = {
  addMode(app, el) {
    app.ui.addMode = el.dataset.v;
    app.ui.addMsg = '';
    app.render(true);
  },
  async addLink(app, form) {
    const f = new FormData(form);
    const url = String(f.get('url')).trim();
    let slug = String(f.get('slug'));
    let label;
    if (slug === '__new') {
      label = String(f.get('newName') || '').trim();
      if (!label) { globalThis.alert('Напиши название нового трюка'); return; }
      const c = createTrick(app, { name: label, status: 'want', needs_method: true });
      slug = c.slug;
      await app.dispatch(c.op);
    }
    await app.dispatch({ type: 'link', path: trickPath(slug), link: { url, title: linkTitle(url), note: String(f.get('note') || '') } });
    ssSet('chase.share', null);
    app.ui.addMsg = `Сохранено в «${label || app.model.bySlug.get(slug)?.meta.name || slug}»`;
    saved(app, 'Ссылка сохранена');
    app.render(true);
  },
  async addTrick(app, form) {
    const f = new FormData(form);
    const status = String(f.get('status'));
    const type = String(f.get('type'));
    const name = String(f.get('name')).trim();
    const meta = {
      name,
      commands: String(f.get('commands') || '').split(',').map((x) => x.trim()).filter(Boolean),
      type,
      place: String(f.get('place')),
      props: f.getAll('props').map(String),
      status,
      needs_method: type !== 'game' && status !== 'known',
    };
    if (status === 'known' || status === 'reinforcing') meta.reliability = 'home';
    if (status === 'known') meta.known_since = today();
    const c = createTrick(app, meta);
    if (status === 'learning' && !confirmLearning(app, c.slug, { name, place: meta.place })) return;
    await app.dispatch(c.op);
    saved(app, `«${name}» добавлен в библиотеку`);
    app.go(`#/trick/${encodeURIComponent(c.slug)}`);
  },
};
