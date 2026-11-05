import { progressStats } from '../../core/stats.js';
import { STATUS, stepWord } from '../../core/labels.js';
import { esc } from '../../core/md.js';

const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const DOW = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

export function view(app) {
  const s = progressStats(app.model.tricks, app.model.sessions);
  const [y, mo] = s.monthKey.split('-').map(Number);
  const offset = (new Date(y, mo - 1, 1).getDay() + 6) % 7;
  const daysIn = new Date(y, mo, 0).getDate();
  const cells = [
    ...Array(offset).fill('<span></span>'),
    ...Array.from({ length: daysIn }, (_, i) => {
      const d = `${s.monthKey}-${String(i + 1).padStart(2, '0')}`;
      return `<span class="${s.days.has(d) ? 'on' : ''}">${i + 1}</span>`;
    }),
  ];
  return `<section class="tiles">
    <div class="tile"><b>${s.week}</b><small>тренировок за 7 дней</small></div>
    <div class="tile"><b>${s.month}</b><small>за ${MONTHS[mo - 1]}</small></div>
    <div class="tile"><b>${s.learnedThisMonth.length}</b><small>выучено в этом месяце</small></div>
    <div class="tile"><b>${s.counts.known}</b><small>знает всего</small></div>
  </section>
  <section class="card"><h2>${MONTHS[mo - 1]} ${y}</h2><div class="cal">${DOW.map((d) => `<span class="dow">${d}</span>`).join('')}${cells.join('')}</div></section>
  <section class="card"><h2>Сейчас учим</h2>${s.learning.length ? `<ul class="lib">${s.learning.map((t) => `<li><a href="#/trick/${encodeURIComponent(t.slug)}"><span class="lib-name">${esc(t.meta.name)}</span><span class="muted small">${stepWord(t)} ${t.meta.step}${t.steps.length ? `/${t.steps.length}` : ''}</span></a></li>`).join('')}</ul>` : '<p class="muted">Ничего — выбери в библиотеке.</p>'}</section>
  ${s.learnedThisMonth.length ? `<section class="card"><h2>Выучено в ${MONTHS[mo - 1].replace(/ь$/, 'е').replace(/й$/, 'е')}</h2><p>${s.learnedThisMonth.map((t) => esc(t.meta.name)).join(', ')}</p></section>` : ''}
  <section class="card"><h2>По статусам</h2><ul class="counts">${Object.entries(STATUS).map(([k, l]) => `<li><span>${l}</span><b>${s.counts[k]}</b></li>`).join('')}</ul></section>`;
}

export const actions = {};
