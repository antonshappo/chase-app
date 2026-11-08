import { BLOCK, LEVEL, RESULT, RESULT_LABEL } from '../../core/labels.js';
import { esc, md, safeUrl } from '../../core/md.js';
import { localIso, logPath } from '../../core/log.js';
import { allSuggestions } from '../../core/rules.js';
import { ssGet, ssSet, suggestionsBlock, visibleSuggestions } from '../helpers.js';

const KEY = 'chase.run';

export function startRun(app, plan) {
  app.ui.run = { plan, index: 0, results: {}, startedAt: localIso() };
  ssSet(KEY, app.ui.run);
  app.go('#/run');
}

const current = (app) => {
  if (!app.ui.run) app.ui.run = ssGet(KEY, null);
  return app.ui.run;
};

function clearRun(app) {
  app.ui.run = null;
  ssSet(KEY, null);
}

const missing = () => '<p class="muted">Этого занятия больше нет в библиотеке — пропусти карточку.</p>';

function linksBlock(t) {
  if (!t.links.length) return '';
  return `<details class="hint"><summary>🔗 Ссылки (${t.links.length})</summary><ul class="links">${t.links.map((l) => `<li><a href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener">${esc(l.title)}</a>${l.note ? ` — ${esc(l.note)}` : ''}</li>`).join('')}</ul></details>`;
}

function hintBlock(t) {
  return t.description ? `<details class="hint"><summary>💡 Подсказка</summary><div class="md">${md(t.description)}</div></details>` : '';
}

const cmd = (t) => (t.meta.commands.length ? `<p class="cmd">Команда: <b>${t.meta.commands.map(esc).join(' / ')}</b></p>` : '');

function cardBody(app, card, plan) {
  const T = (s) => app.model.bySlug.get(s);
  switch (card.block) {
    case 'warmup':
    case 'chain': {
      const lead = card.block === 'warmup'
        ? 'Выполни подряд, «Да!» и награда за каждую команду. Темп бодрый.'
        : 'Цепочка: команды подряд без награды между ними, в конце — джекпот (много вкусняшек или игра).';
      const items = card.slugs.map(T).filter(Boolean);
      return `<h2>${BLOCK[card.block].title}</h2><p>${lead}</p><ol class="chain">${items.map((t) => `<li><b>${esc(t.meta.name)}</b>${t.meta.commands.length && t.meta.commands.join(' / ') !== t.meta.name ? ` <span class="muted">«${t.meta.commands.map(esc).join(' / ')}»</span>` : ''}</li>`).join('')}</ol>`;
    }
    case 'new': {
      const t = T(card.slugs[0]);
      if (!t) return missing();
      const step = t.steps[card.step - 1];
      return `<h2>${esc(t.meta.name)}</h2>${cmd(t)}
        <p class="step-label">Шаг ${card.step}${t.steps.length ? ` из ${t.steps.length}` : ''}${step ? `: <b>${esc(step.title)}</b>` : ''}</p>
        ${step ? `<div class="md">${md(step.body)}</div>` : '<p class="muted">Методики пока нет — посмотри ссылки. Claude допишет шаги.</p>'}
        <p class="muted small">5–7 минут, заканчивай на удачном повторе.</p>${hintBlock(t)}${linksBlock(t)}`;
    }
    case 'repeat': {
      const t = T(card.slugs[0]);
      if (!t) return missing();
      const lvl = card.tryLevel
        ? `<p class="level">Сейчас: <b>${LEVEL[t.meta.reliability || 'home']}</b>. Попробуй: <b>${LEVEL[card.tryLevel]}</b></p>`
        : '';
      return `<h2>${esc(t.meta.name)}</h2>${cmd(t)}${lvl}<p>3–5 повторов, «Да!» и награда за каждый. Меняй место и позу.</p>${hintBlock(t)}${linksBlock(t)}`;
    }
    case 'game': {
      const t = T(card.slugs[0]);
      if (!t) return missing();
      const steps = t.steps.length ? `<ol class="steps">${t.steps.map((s) => `<li><b>${esc(s.title)}</b><div class="md">${md(s.body)}</div></li>`).join('')}</ol>` : '';
      return `<h2>🎲 ${esc(t.meta.name)}</h2><div class="md">${md(t.description)}</div>${steps}${t.extra.map((x) => `<details class="hint"><summary>${esc(x.title)}</summary><div class="md">${md(x.md)}</div></details>`).join('')}${linksBlock(t)}`;
    }
    case 'finale': {
      const t = T(card.slugs[0]);
      if (!t) return missing();
      return `<h2>🏁 ${esc(t.meta.name)}</h2>${cmd(t)}<p>Закончи на успехе: команда, которую Чейз точно выполнит, и большая награда.</p>`;
    }
    case 'pick':
      return `<h2>Новое</h2><p>${plan.place === 'outdoor' ? 'На улице' : 'Дома'} сейчас ничего не учим. После тренировки выбери новый трюк в «Библиотеке» или прямо на экране «Тренировка».</p>`;
    default:
      return '';
  }
}

export function view(app) {
  const run = current(app);
  if (!run) return '<section class="card"><p>Тренировка не начата.</p><a class="btn primary" href="#/train">К тренировке</a></section>';
  const { plan, index } = run;
  const card = plan.cards[index];
  const total = plan.cards.length;
  const last = index === total - 1;
  const rate = card.block === 'pick' ? '' : `<div class="rate" role="group" aria-label="Как получилось">${Object.entries(RESULT).map(([k, e]) => `<button class="${run.results[index] === k ? 'on' : ''}" data-act="runRate" data-v="${k}" aria-label="${RESULT_LABEL[k]}" title="${RESULT_LABEL[k]}">${e}</button>`).join('')}</div>`;
  return `<section class="card run">
    <div class="run-top"><span class="muted">${index + 1} / ${total} · ${BLOCK[card.block].title.toUpperCase()}</span><button class="icon-btn" data-act="runQuit" aria-label="Завершить">✕</button></div>
    <div class="progress"><span style="width:${((index + 1) / total) * 100}%"></span></div>
    ${cardBody(app, card, plan)}
    ${rate}
    <div class="run-nav">
      <button class="btn ghost" data-act="runPrev"${index === 0 ? ' disabled' : ''}>◀ Назад</button>
      ${last ? '<button class="btn primary" data-act="runFinish">Завершить ✓</button>' : '<button class="btn primary" data-act="runNext">Далее ▶</button>'}
    </div>
  </section>`;
}

export function doneView(app) {
  const d = app.ui.done;
  if (!d) return '<section class="card"><p>Готово!</p><a class="btn primary" href="#/train">К тренировке</a></section>';
  const c = { good: 0, ok: 0, bad: 0 };
  for (const x of d.session.items) if (x.result) c[x.result]++;
  const tricks = app.model.tricks.filter((t) => d.slugs.includes(t.slug));
  const sug = visibleSuggestions(allSuggestions(tricks, app.model.sessions));
  return `<section class="card done"><h1>Молодцы! 🎉</h1>
    <p>${d.session.items.length} упражнений · 👍 ${c.good} · 👌 ${c.ok} · 👎 ${c.bad}</p>
    <a class="btn primary" href="#/train">На главную</a></section>${suggestionsBlock(sug)}`;
}

async function finish(app) {
  const r = current(app);
  const items = r.plan.cards.flatMap((c, i) => (c.block === 'pick' ? [] : c.slugs.map((slug) => ({
    trick: slug,
    block: c.block,
    ...(c.step ? { step: c.step } : {}),
    ...(c.tryLevel ? { level: c.tryLevel } : {}),
    result: r.results[i] || null,
  }))));
  const session = { id: r.startedAt, place: r.plan.place, minutes: r.plan.minutes, items };
  app.ui.done = { session, slugs: [...new Set(items.map((x) => x.trick))] };
  app.ui.plan = null;
  clearRun(app);
  await app.dispatch({ type: 'session', path: logPath(session.id), session });
  app.go('#/done');
}

function save(app) {
  ssSet(KEY, app.ui.run);
  app.render(true);
}

export const actions = {
  runRate(app, el) {
    const r = current(app);
    r.results[r.index] = r.results[r.index] === el.dataset.v ? null : el.dataset.v;
    save(app);
  },
  runNext(app) {
    const r = current(app);
    if (r && r.index < r.plan.cards.length - 1) { r.index++; save(app); globalThis.scrollTo?.(0, 0); }
  },
  runPrev(app) {
    const r = current(app);
    if (r && r.index > 0) { r.index--; save(app); globalThis.scrollTo?.(0, 0); }
  },
  runFinish: finish,
  async runQuit(app) {
    const r = current(app);
    if (!r) return app.go('#/train');
    if (Object.values(r.results).some(Boolean)) {
      if (globalThis.confirm('Завершить тренировку? Отметки сохранятся.')) await finish(app);
    } else if (globalThis.confirm('Выйти из тренировки без сохранения?')) {
      clearRun(app);
      app.go('#/train');
    }
  },
};
