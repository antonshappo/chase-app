import { STATUS, TYPE, PLACE, PROPS, LEVEL, RESULT, BLOCK, stepWord } from '../../core/labels.js';
import { esc, md, safeUrl } from '../../core/md.js';
import { entriesFor } from '../../core/log.js';
import { suggestionsFor } from '../../core/rules.js';
import { trickPath } from '../../core/trick.js';
import { singleSession } from '../../core/generator.js';
import { startRun } from './run.js';
import {
  options, setMeta, suggestionsBlock, visibleSuggestions, confirmLearning, lsGet, lsSet, today,
} from '../helpers.js';

const fmtDate = (iso) => iso.slice(0, 10).split('-').reverse().join('.');

export function view(app, [slug]) {
  const t = app.model.bySlug.get(slug);
  if (!t) return '<section class="card"><p>Не найдено.</p><a href="#/library">← Библиотека</a></section>';
  const m = t.meta;
  const word = stepWord(t);
  const s = esc(slug);
  const hist = entriesFor(slug, app.model.sessions).slice(-10).reverse();
  const sug = visibleSuggestions(suggestionsFor(t, app.model.sessions));
  const stepOpts = Array.from({ length: Math.max(t.steps.length, 1) }, (_, i) => i + 1);

  const fields = `<div class="fields">
    <label>Статус <select data-change="trickStatus" data-slug="${s}">${options(STATUS, m.status)}</select></label>
    ${m.type !== 'game' ? `<label>${word} <select data-change="trickField" data-slug="${s}" data-k="step">${stepOpts.map((n) => `<option value="${n}"${n === m.step ? ' selected' : ''}>${n}${t.steps[n - 1] ? `. ${esc(t.steps[n - 1].title)}` : ''}</option>`).join('')}</select></label>` : ''}
    ${(m.status === 'known' || m.status === 'reinforcing') && m.type !== 'game' ? `<label>Надёжность <select data-change="trickField" data-slug="${s}" data-k="reliability">${options(LEVEL, m.reliability || 'home')}</select></label>` : ''}
    <label class="check"><input type="checkbox" data-change="trickFlag" data-k="favorite" data-slug="${s}"${m.favorite ? ' checked' : ''}> ⭐ Подходит для финала</label>
    <label class="check"><input type="checkbox" data-change="trickFlag" data-k="in_plan" data-slug="${s}"${m.in_plan !== false ? ' checked' : ''}> 🎲 Предлагать в тренировках</label>
  </div>`;

  const mainBtn = m.status === 'want'
    ? `<button class="btn primary" data-act="trickLearn" data-slug="${s}">📚 Начать учить</button>`
    : `<button class="btn primary" data-act="trickRun" data-slug="${s}">▶ Заниматься сейчас</button>`;

  const steps = t.steps.length
    ? `<section class="card"><h2>${m.type === 'project' ? 'Уровни' : 'Шаги'}</h2><ol class="steps">${t.steps.map((st, i) => {
      const cur = m.type !== 'game' && i + 1 === m.step;
      return `<li class="${cur && m.status === 'learning' ? 'current' : ''}"><details${cur ? ' open' : ''}><summary>${esc(st.title)}</summary><div class="md">${md(st.body)}</div></details></li>`;
    }).join('')}</ol></section>`
    : m.needs_method ? '<section class="card"><p class="muted">Методики пока нет. Попроси Claude: «допиши методику для этого трюка».</p></section>' : '';

  const links = `<section class="card"><h2>Ссылки</h2>
    ${t.links.length ? `<ul class="links">${t.links.map((l) => `<li><a href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener">${esc(l.title)}</a>${l.note ? ` — ${esc(l.note)}` : ''}</li>`).join('')}</ul>` : '<p class="muted">Пока нет.</p>'}
    <form class="inline-form" data-submit="trickAddLink" data-slug="${s}">
      <input name="url" type="url" required placeholder="https://…">
      <input name="note" placeholder="Что тут полезного (необязательно)">
      <button class="btn">Добавить ссылку</button>
    </form></section>`;

  const history = `<section class="card"><h2>История</h2>${hist.length ? `<ul class="hist">${hist.map((h) => `<li><span>${fmtDate(h.date)}</span><span>${BLOCK[h.block]?.title || esc(h.block)}${h.step ? ` · ${word.toLowerCase()} ${h.step}` : ''}${h.level ? ` · ${LEVEL[h.level]}` : ''}</span><span>${RESULT[h.result] || '—'}</span></li>`).join('')}</ul>` : '<p class="muted">Ещё не занимались.</p>'}</section>`;

  const edit = `<details class="card edit"><summary>✏️ Место и реквизит</summary>
    <form class="stack" data-submit="trickEdit" data-slug="${s}">
      <label>Где<select name="place">${options(PLACE, m.place)}</select></label>
      <fieldset class="props">${Object.entries(PROPS).map(([k, l]) => `<label class="check"><input type="checkbox" name="props" value="${k}"${m.props.includes(k) ? ' checked' : ''}> ${esc(l)}</label>`).join('')}</fieldset>
      <button class="btn">Сохранить</button>
    </form></details>`;

  return `<a class="back" href="#/library">← Библиотека</a>
  ${t.error ? `<p class="warn">⚠️ Ошибка в файле: ${esc(t.error)}</p>` : ''}
  <section class="card">
    <h1>${esc(m.name)}</h1>
    ${m.commands.length ? `<p class="cmd">Команда: <b>${m.commands.map(esc).join(' / ')}</b></p>` : ''}
    <p class="muted">${TYPE[m.type] || ''} · ${PLACE[m.place] || ''}${m.props.length ? ` · ${m.props.map((p) => esc(PROPS[p] || p)).join(', ')}` : ''}</p>
    ${fields}${mainBtn}
  </section>
  ${suggestionsBlock(sug)}
  ${t.description ? `<section class="card"><h2>Описание</h2><div class="md">${md(t.description)}</div></section>` : ''}
  ${steps}
  ${t.extra.map((x) => `<section class="card"><h2>${esc(x.title)}</h2><div class="md">${md(x.md)}</div></section>`).join('')}
  ${links}
  <section class="card"><h2>Заметки</h2><form class="stack" data-submit="trickNotes" data-slug="${s}"><textarea name="notes" rows="3">${esc(t.notes)}</textarea><button class="btn">Сохранить заметку</button></form></section>
  ${history}
  ${edit}`;
}

export const actions = {
  async trickStatus(app, el) {
    const slug = el.dataset.slug;
    const t = app.model.bySlug.get(slug);
    const to = el.value;
    const from = t.meta.status;
    if (to === from) return;
    if (to === 'learning' && !confirmLearning(app, slug)) { el.value = from; return; }
    const patch = { status: to };
    if (to === 'learning' && (from === 'known' || from === 'reinforcing')) patch.step = 1;
    if (to === 'known') patch.known_since = today();
    if ((to === 'reinforcing' || to === 'known') && !t.meta.reliability) patch.reliability = 'home';
    await setMeta(app, slug, patch);
  },
  async trickField(app, el) {
    const v = el.dataset.k === 'step' ? Number(el.value) : el.value;
    await setMeta(app, el.dataset.slug, { [el.dataset.k]: v });
  },
  async trickFlag(app, el) {
    await setMeta(app, el.dataset.slug, { [el.dataset.k]: el.checked });
  },
  async trickLearn(app, el) {
    if (confirmLearning(app, el.dataset.slug)) await setMeta(app, el.dataset.slug, { status: 'learning', step: 1 });
  },
  trickRun(app, el) {
    startRun(app, singleSession(app.model.bySlug.get(el.dataset.slug)));
  },
  async trickAddLink(app, form) {
    const f = new FormData(form);
    await app.dispatch({
      type: 'link', path: trickPath(form.dataset.slug), link: { url: String(f.get('url')).trim(), note: String(f.get('note') || '') },
    });
  },
  async trickNotes(app, form) {
    const f = new FormData(form);
    await app.dispatch({ type: 'notes', path: trickPath(form.dataset.slug), notes: String(f.get('notes') || '') });
  },
  async trickEdit(app, form) {
    const f = new FormData(form);
    await setMeta(app, form.dataset.slug, { place: String(f.get('place')), props: f.getAll('props').map(String) });
  },
  async sugApply(app, el) {
    await setMeta(app, el.dataset.slug, JSON.parse(el.dataset.patch));
  },
  sugDismiss(app, el) {
    lsSet('chase.dismissed', [...lsGet('chase.dismissed', []), el.dataset.key].slice(-300));
    app.render(true);
  },
};
