import { PROPS } from '../../core/labels.js';
import { esc } from '../../core/md.js';

const STATE_TEXT = {
  idle: 'ещё не синхронизировано', ok: 'всё сохранено', syncing: 'синхронизация…', pending: 'есть неотправленные изменения',
  offline: 'нет сети', error: 'ошибка', auth: 'нужен новый ключ',
};

export function view(app) {
  const have = new Set(app.model.settings.props);
  const st = app.status;
  return `<section class="card"><h1>Настройки</h1>
    <h2>Реквизит под рукой</h2>
    <p class="muted small">Тренировка предлагает только занятия, для которых всё есть. Вкусняшки есть всегда.</p>
    <fieldset class="props">${Object.entries(PROPS).filter(([k]) => k !== 'treats').map(([k, l]) => `<label class="check"><input type="checkbox" data-change="setProp" value="${k}"${have.has(k) ? ' checked' : ''}> ${esc(l)}</label>`).join('')}</fieldset>
  </section>
  <section class="card"><h2>Синхронизация</h2>
    <p>Состояние: ${STATE_TEXT[st.state] || esc(st.state)}${st.pending ? ` · ждёт отправки: ${st.pending}` : ''}</p>
    ${st.error ? `<p class="warn">${esc(st.error)}</p>` : ''}
    <div class="row"><button class="btn" data-act="sync">🔄 Синхронизировать</button><button class="btn ghost" data-act="setLogout">🔑 Сменить ключ</button></div>
  </section>
  <section class="card"><h2>Установка на телефон</h2>
    <p class="small">iPhone: Safari → «Поделиться» → «На экран „Домой“». Android: Chrome → ⋮ → «Установить приложение». После установки работает без сети, а на Android можно делиться ссылками из Instagram/YouTube прямо в «Чейз».</p>
  </section>`;
}

export const actions = {
  async setProp(app, el) {
    const cur = new Set(app.model.settings.props);
    if (el.checked) cur.add(el.value);
    else cur.delete(el.value);
    await app.dispatch({ type: 'settings', path: 'settings.json', patch: { props: [...cur] } });
  },
  async setLogout(app) {
    const msg = app.status.pending
      ? `Есть неотправленные изменения (${app.status.pending}). Они пропадут. Продолжить?`
      : 'Выйти и ввести ключ заново?';
    if (globalThis.confirm(msg)) await app.logout();
  },
};
