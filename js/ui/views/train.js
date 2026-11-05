import { buildSession, swapCard } from '../../core/generator.js';
import { allSuggestions } from '../../core/rules.js';
import { BLOCK, PLACE } from '../../core/labels.js';
import { esc } from '../../core/md.js';
import { trickName, lsGet, lsSet, suggestionsBlock, visibleSuggestions, setMeta, confirmLearning } from '../helpers.js';
import { startRun } from './run.js';

const setup = () => lsGet('chase.setup', { place: 'home', minutes: 20 });

function cardLine(app, c) {
  if (c.block === 'pick') {
    return `Сейчас ничего не учим — выбери: ${c.options.slice(0, 6).map((s) => `<button class="chip" data-act="trainPick" data-slug="${esc(s)}">${esc(trickName(app, s))}</button>`).join(' ')}`;
  }
  return c.slugs.map((s) => esc(trickName(app, s))).join(' → ');
}

function planView(app, plan) {
  return `<section class="card plan">
    <h2>План: ${PLACE[plan.place]}${plan.minutes ? ` · ${plan.minutes} мин` : ''}</h2>
    <ol class="plan-list">${plan.cards.map((c, i) => `<li><div><b>${BLOCK[c.block].title}</b><span>${cardLine(app, c)}</span></div>${c.block === 'pick' ? '' : `<button class="icon-btn" data-act="trainSwap" data-i="${i}" aria-label="Заменить">🔄</button>`}</li>`).join('')}</ol>
    <button class="btn primary big" data-act="trainStart">Начать ▶</button>
  </section>`;
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
    app.ui.plan = swapCard(app.ui.plan, Number(el.dataset.i), { tricks: app.model.tricks, props: app.model.settings.props });
    app.render(true);
  },
  async trainPick(app, el) {
    if (!confirmLearning(app, el.dataset.slug)) return;
    await setMeta(app, el.dataset.slug, { status: 'learning', step: 1 });
    build(app);
  },
  trainStart(app) {
    if (app.ui.plan?.cards.length) startRun(app, app.ui.plan);
  },
};
