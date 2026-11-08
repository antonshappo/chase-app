import { TYPE, TYPE_HINT, PLACE, PROPS } from '../../core/labels.js';
import { esc } from '../../core/md.js';
import { trickPath } from '../../core/trick.js';
import { options, saved } from '../helpers.js';

const BLANK = {
  steps: () => ({ title: '', body: '' }),
  extra: () => ({ title: '', md: '' }),
  links: () => ({ title: '', url: '', note: '' }),
};

function fromTrick(t) {
  return {
    name: t.meta.name,
    commands: t.meta.commands.join(', '),
    type: t.meta.type,
    place: t.meta.place,
    props: [...t.meta.props],
    description: t.description,
    steps: t.steps.map((s) => ({ ...s })),
    extra: t.extra.map((x) => ({ ...x })),
    links: t.links.map((l) => ({ ...l })),
    notes: t.notes,
  };
}

// Черновик редактирования живёт в app.ui.edit, пока не нажали «Сохранить» или «Отмена».
function draft(app, slug) {
  const t = app.model.bySlug.get(slug);
  if (!t) return null;
  if (app.ui.edit?.slug !== slug) app.ui.edit = { slug, data: fromTrick(t) };
  return app.ui.edit.data;
}

export function readEditForm(form) {
  const v = (n) => form.elements.namedItem(n)?.value ?? '';
  const rows = (kind) => [...form.querySelectorAll(`[data-row="${kind}"]`)]
    .map((row) => Object.fromEntries([...row.querySelectorAll('[data-f]')].map((el) => [el.dataset.f, el.value])));
  return {
    name: v('name'),
    commands: v('commands'),
    type: v('type'),
    place: v('place'),
    props: [...form.querySelectorAll('input[name=props]:checked')].map((el) => el.value),
    description: v('description'),
    steps: rows('steps'),
    extra: rows('extra'),
    links: rows('links'),
    notes: v('notes'),
  };
}

function tools(kind, i, n) {
  const b = (op, label, icon, off) => `<button type="button" class="icon-btn" data-act="editRow" data-kind="${kind}" data-op="${op}" data-i="${i}" aria-label="${label}"${off ? ' disabled' : ''}>${icon}</button>`;
  return `<div class="row-tools">${b('up', 'Выше', '↑', i === 0)}${b('down', 'Ниже', '↓', i === n - 1)}${b('del', 'Удалить', '🗑', false)}</div>`;
}

const addBtn = (kind, label) => `<button type="button" class="btn" data-act="editRow" data-kind="${kind}" data-op="add">＋ ${label}</button>`;

export function view(app, [slug]) {
  const d = draft(app, slug);
  if (!d) return '<section class="card"><p>Не найдено.</p><a href="#/library">← Библиотека</a></section>';
  const s = esc(slug);

  const steps = d.steps.map((st, i) => `<fieldset class="edit-row" data-row="steps">
    <div class="edit-row-head"><b>Шаг ${i + 1}</b>${tools('steps', i, d.steps.length)}</div>
    <input name="steps-${i}-title" data-f="title" value="${esc(st.title)}" placeholder="Короткое название шага" aria-label="Название шага ${i + 1}">
    <textarea name="steps-${i}-body" data-f="body" rows="4" placeholder="Что делать, сколько повторов, когда переходить дальше" aria-label="Текст шага ${i + 1}">${esc(st.body)}</textarea>
  </fieldset>`).join('');

  const extra = d.extra.map((x, i) => `<fieldset class="edit-row" data-row="extra">
    <div class="edit-row-head"><b>Раздел ${i + 1}</b>${tools('extra', i, d.extra.length)}</div>
    <input name="extra-${i}-title" data-f="title" value="${esc(x.title)}" placeholder="Например: Частые ошибки" aria-label="Название раздела ${i + 1}">
    <textarea name="extra-${i}-md" data-f="md" rows="3" aria-label="Текст раздела ${i + 1}">${esc(x.md)}</textarea>
  </fieldset>`).join('');

  const links = d.links.map((l, i) => `<fieldset class="edit-row" data-row="links">
    <div class="edit-row-head"><b>Ссылка ${i + 1}</b>${tools('links', i, d.links.length)}</div>
    <input name="links-${i}-url" data-f="url" type="url" value="${esc(l.url)}" placeholder="https://…" aria-label="Адрес ссылки ${i + 1}">
    <input name="links-${i}-title" data-f="title" value="${esc(l.title)}" placeholder="Название (YouTube, Instagram…)" aria-label="Название ссылки ${i + 1}">
    <input name="links-${i}-note" data-f="note" value="${esc(l.note)}" placeholder="Что тут полезного" aria-label="Подпись ссылки ${i + 1}">
  </fieldset>`).join('');

  return `<a class="back" href="#/trick/${encodeURIComponent(slug)}" data-act="editCancel">← Отмена</a>
  <form class="stack edit-form" data-submit="editSave" data-slug="${s}" novalidate>
    <section class="card stack">
      <h1>Редактировать</h1>
      <label>Название<input name="name" required value="${esc(d.name)}"></label>
      <label>Команда (через запятую)<input name="commands" value="${esc(d.commands)}" placeholder="Например: Пятка, Носок"></label>
      <label>Тип<select name="type">${options(TYPE, d.type)}</select></label>
      <ul class="hint-text type-hints">${Object.entries(TYPE).map(([k, l]) => `<li><b>${l}</b> — ${TYPE_HINT[k]}</li>`).join('')}</ul>
      <label>Где можно заниматься<select name="place">${options(PLACE, d.place)}</select></label>
      <fieldset class="props"><legend class="muted small">Реквизит</legend>${Object.entries(PROPS).map(([k, l]) => `<label class="check"><input type="checkbox" name="props" value="${k}"${d.props.includes(k) ? ' checked' : ''}> ${esc(l)}</label>`).join('')}</fieldset>
    </section>
    <section class="card stack">
      <h2>Описание</h2>
      <textarea name="description" rows="4" aria-label="Описание">${esc(d.description)}</textarea>
      <p class="hint-text">Можно выделять **жирным** и делать списки — строки, начинающиеся с «- ».</p>
    </section>
    <section class="card stack">
      <h2>Шаги</h2>
      ${steps || '<p class="muted">Шагов пока нет.</p>'}
      ${addBtn('steps', 'Добавить шаг')}
    </section>
    <section class="card stack">
      <h2>Другие разделы</h2>
      <p class="hint-text">Например «Частые ошибки», «Усложнения», «Как повторять».</p>
      ${extra}
      ${addBtn('extra', 'Добавить раздел')}
    </section>
    <section class="card stack">
      <h2>Ссылки</h2>
      ${links || '<p class="muted">Ссылок пока нет.</p>'}
      ${addBtn('links', 'Добавить ссылку')}
    </section>
    <section class="card stack">
      <h2>Заметки</h2>
      <textarea name="notes" rows="3" aria-label="Заметки">${esc(d.notes)}</textarea>
    </section>
    <div class="edit-actions"><button class="btn primary big">💾 Сохранить изменения</button></div>
  </form>`;
}

export const actions = {
  editRow(app, el) {
    const form = el.closest('form');
    const d = readEditForm(form);
    const list = d[el.dataset.kind];
    const i = Number(el.dataset.i);
    if (el.dataset.op === 'add') list.push(BLANK[el.dataset.kind]());
    if (el.dataset.op === 'del') list.splice(i, 1);
    if (el.dataset.op === 'up' && i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]];
    if (el.dataset.op === 'down' && i < list.length - 1) [list[i + 1], list[i]] = [list[i], list[i + 1]];
    app.ui.edit.data = d;
    app.skipDraft = `editSave:${form.dataset.slug}`; // строки сдвинулись — старые черновики полей не восстанавливаем
    app.render(true);
    if (el.dataset.op === 'add') {
      const rows = document.querySelectorAll(`[data-row="${el.dataset.kind}"]`);
      rows[rows.length - 1]?.querySelector('[data-f]')?.focus();
    }
  },
  editCancel(app) {
    const slug = app.ui.edit?.slug;
    app.ui.edit = null;
    app.go(slug ? `#/trick/${encodeURIComponent(slug)}` : '#/library');
  },
  async editSave(app, form) {
    const slug = form.dataset.slug;
    const t = app.model.bySlug.get(slug);
    const d = readEditForm(form);
    app.ui.edit = { slug, data: d };
    app.skipDraft = null;
    const name = d.name.trim();
    if (!name) { globalThis.alert('Название не может быть пустым'); return; }
    const links = d.links.filter((l) => l.url.trim() || l.title.trim() || l.note.trim());
    const bad = links.find((l) => !/^https?:\/\/\S+$/i.test(l.url.trim()));
    if (bad) { globalThis.alert(`Ссылка должна начинаться с https:// — проверь «${bad.url || bad.title || bad.note}»`); return; }
    const steps = d.steps.filter((x) => x.title.trim() || x.body.trim());
    const meta = {
      name,
      commands: d.commands.split(',').map((x) => x.trim()).filter(Boolean),
      type: d.type,
      place: d.place,
      props: d.props,
    };
    if (steps.length) meta.needs_method = false;
    if (t && t.meta.step > Math.max(steps.length, 1)) meta.step = Math.max(steps.length, 1);
    await app.dispatch({
      type: 'edit',
      path: trickPath(slug),
      meta,
      content: {
        description: d.description,
        steps,
        extra: d.extra.filter((x) => x.title.trim() || x.md.trim()),
        links: links.map((l) => ({ ...l, url: l.url.trim() })),
        notes: d.notes,
      },
    });
    app.ui.edit = null;
    saved(app, 'Изменения сохранены');
    app.go(`#/trick/${encodeURIComponent(slug)}`);
  },
};
