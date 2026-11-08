import { buildSession, swapCard, eligible, newCard } from '../../core/generator.js';
import { allSuggestions } from '../../core/rules.js';
import { BLOCK, PLACE } from '../../core/labels.js';
import { esc } from '../../core/md.js';
import { trickName, lsGet, lsSet, suggestionsBlock, visibleSuggestions, startLearning, info } from '../helpers.js';
import { startRun } from './run.js';

const setup = () => lsGet('chase.setup', { place: 'home', minutes: 20 });

const where = (plan) => (plan.place === 'outdoor' ? 'на улице' : 'дома');
const isNew = (c) => c.block === 'new' || c.block === 'pick';
// Список выбора для «Нового» открыт сам, если учить пока нечего; иначе — по кнопке «Выбрать».
const pickerOpen = (app, c) => app.ui.newOpen ?? c.block === 'pick';

function cardLine(app, c, plan) {
  if (c.block === 'pick') return `${where(plan) === 'дома' ? 'Дома' : 'На улице'} сейчас ничего не учим — выбери ниже`;
  return c.slugs.map((s) => esc(trickName(app, s))).join(' → ');
}

function newPicker(app, plan, i) {
  const pool = app.model.tricks.filter((t) => t.meta.type !== 'game' && eligible(t, plan.place, app.model.settings.props));
  const learning = pool.filter((t) => t.meta.status === 'learning');
  const want = pool.filter((t) => t.meta.status === 'want');
  const cur = plan.cards[i].slugs[0];
  const step = (t) => `шаг ${t.meta.step}${t.steps.length ? `/${t.steps.length}` : ''}`;
  return `<div class="picker">
    <p class="picker-title">Сейчас учим ${where(plan)}</p>
    ${learning.length ? `<ul class="pick-list">${learning.map((t) => `<li><button class="pick-opt${t.slug === cur ? ' on' : ''}" data-act="trainNewSet" data-i="${i}" data-slug="${esc(t.slug)}"${t.slug === cur ? ' aria-current="true"' : ''}><span>${t.slug === cur ? '● ' : ''}${esc(t.meta.name)}</span><small>${step(t)}</small></button></li>`).join('')}</ul>` : '<p class="muted small">Пока ничего.</p>'}
    ${want.length ? `<p class="picker-title">Начать учить новое</p><div class="chips">${want.map((t) => `<button class="chip" data-act="trainPick" data-i="${i}" data-slug="${esc(t.slug)}">${esc(t.meta.name)}</button>`).join(' ')}</div>` : ''}
  </div>`;
}

function rowButton(app, c, i) {
  if (!isNew(c)) return `<button class="icon-btn" data-act="trainSwap" data-i="${i}" aria-label="Заменить случайно">🔄</button>`;
  const open = pickerOpen(app, c);
  return `<button class="btn small" data-act="trainNewToggle" data-i="${i}" aria-expanded="${open}">Выбрать ${open ? '▴' : '▾'}</button>`;
}

function planView(app, plan) {
  return `<section class="card plan">
    <h2>План: ${PLACE[plan.place]}${plan.minutes ? ` · ${plan.minutes} мин` : ''}</h2>
    <ol class="plan-list">${plan.cards.map((c, i) => `<li><div><b>${BLOCK[c.block].title}</b><span>${cardLine(app, c, plan)}</span></div>${rowButton(app, c, i)}${isNew(c) && pickerOpen(app, c) ? newPicker(app, plan, i) : ''}</li>`).join('')}</ol>
    <button class="btn primary big" data-act="trainStart">Начать ▶</button>
  </section>`;
}

function setCard(app, i, card) {
  app.ui.plan = { ...app.ui.plan, cards: app.ui.plan.cards.map((c, j) => (j === i ? card : c)) };
}

export function view(app) {
  const s = setup();
  const plan = app.ui.plan;
  const sug = visibleSuggestions(allSuggestions(app.model.tricks, app.model.sessions));
  const empty = app.model.tricks.length
    ? ''
    : '<p class="muted">Библиотека пока пустая — данные загружаются или репозиторий пуст.</p>';
  return `<section class="card setup">
    <h1>Чем займёмся с Чейзом?</h1>${empty}
    <div class="seg" role="group" aria-label="Место">${['home', 'outdoor'].map((p) => `<button class="${s.place === p ? 'on' : ''}" data-act="trainPlace" data-v="${p}">${PLACE[p]}</button>`).join('')}</div>
    <div class="seg" role="group" aria-label="Время">${[10, 20, 30].map((m) => `<button class="${s.minutes === m ? 'on' : ''}" data-act="trainMinutes" data-v="${m}">${m} мин</button>`).join('')}</div>
    <button class="btn ${plan ? '' : 'primary '}big" data-act="trainBuild">${plan ? '🔄 Собрать заново' : 'Собрать тренировку'}</button>
  </section>
  ${plan ? planView(app, plan) : ''}
  ${suggestionsBlock(sug)}`;
}

function build(app) {
  const s = setup();
  app.ui.plan = buildSession({
    tricks: app.model.tricks, sessions: app.model.sessions, place: s.place, minutes: s.minutes, props: app.model.settings.props,
  });
  app.ui.newOpen = undefined;
  app.render(true);
}

export const actions = {
  trainPlace(app, el) {
    lsSet('chase.setup', { ...setup(), place: el.dataset.v });
    app.ui.plan = null;
    app.render(true);
  },
  trainMinutes(app, el) {
    lsSet('chase.setup', { ...setup(), minutes: Number(el.dataset.v) });
    app.ui.plan = null;
    app.render(true);
  },
  trainBuild: build,
  trainSwap(app, el) {
    const before = app.ui.plan;
    const card = before.cards[Number(el.dataset.i)];
    app.ui.plan = swapCard(before, Number(el.dataset.i), { tricks: app.model.tricks, props: app.model.settings.props });
    if (app.ui.plan === before) {
      const where = before.place === 'outdoor' ? 'для улицы' : 'для дома';
      info(app, card.block === 'new'
        ? `Другого в «Учим» ${where} нет. Новое можно выбрать в библиотеке.`
        : `Заменить не на что: других подходящих занятий ${where} нет.`);
      return;
    }
    app.render(true);
  },
  trainNewToggle(app, el) {
    const c = app.ui.plan.cards[Number(el.dataset.i)];
    app.ui.newOpen = !pickerOpen(app, c);
    app.render(true);
  },
  trainNewSet(app, el) {
    const t = app.model.bySlug.get(el.dataset.slug);
    if (!t) return;
    setCard(app, Number(el.dataset.i), newCard(t));
    app.ui.newOpen = false;
    app.render(true);
    info(app, `Новое: «${t.meta.name}»`);
  },
  async trainPick(app, el) {
    const slug = el.dataset.slug;
    const i = Number(el.dataset.i);
    const t = app.model.bySlug.get(slug);
    if (!t || !globalThis.confirm(`Начать учить «${t.meta.name}» ${where(app.ui.plan)}? Он будет в блоке «Новое» каждой тренировки, пока не выучите.`)) return;
    const prevCard = app.ui.plan.cards[i];
    await startLearning(app, slug, () => {
      const now = app.model.bySlug.get(slug);
      if (app.ui.plan) setCard(app, i, now?.meta.status === 'learning' ? newCard(now) : prevCard);
      app.ui.newOpen = false;
      app.render(true);
    });
  },
  trainStart(app) {
    if (app.ui.plan?.cards.length) startRun(app, app.ui.plan);
  },
};
