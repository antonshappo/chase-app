import { buildModel } from '../core/model.js';
import { esc } from '../core/md.js';
import { shell, badge } from './views/layout.js';
import * as train from './views/train.js';
import * as run from './views/run.js';
import * as library from './views/library.js';
import * as trick from './views/trick.js';
import * as add from './views/add.js';
import * as progress from './views/progress.js';
import * as settings from './views/settings.js';

const ROUTES = {
  train: train.view,
  run: run.view,
  done: run.doneView,
  library: library.view,
  trick: trick.view,
  add: add.view,
  progress: progress.view,
  settings: settings.view,
};

const ACTIONS = {
  ...train.actions,
  ...run.actions,
  ...library.actions,
  ...trick.actions,
  ...add.actions,
  ...progress.actions,
  ...settings.actions,
  sync: (app) => app.sync.sync(),
};

const isField = (el) => el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);

const formKey = (form) => `${form.dataset.submit}:${form.dataset.slug || ''}`;
const fieldKey = (el) => (el.type === 'checkbox' || el.type === 'radio' ? `${el.name}=${el.value}` : el.name);

function isChanged(el) {
  if (el.type === 'checkbox' || el.type === 'radio') return el.checked !== el.defaultChecked;
  if (el.tagName === 'SELECT') return [...el.options].some((o) => o.selected !== o.defaultSelected);
  return el.value !== el.defaultValue;
}

// Несохранённый ввод в формах переживает перерисовку экрана (например, когда в фоне закончилась синхронизация).
function captureDrafts(root, skipKey) {
  const drafts = new Map();
  for (const form of root.querySelectorAll('form[data-submit]')) {
    const key = formKey(form);
    if (key === skipKey) continue;
    for (const el of form.querySelectorAll('input[name], textarea[name], select[name]')) {
      if (!isChanged(el)) continue;
      drafts.set(`${key}|${fieldKey(el)}`, el.type === 'checkbox' || el.type === 'radio' ? el.checked : el.value);
    }
  }
  return drafts;
}

function restoreDrafts(root, drafts) {
  if (!drafts.size) return;
  for (const form of root.querySelectorAll('form[data-submit]')) {
    const key = formKey(form);
    for (const el of form.querySelectorAll('input[name], textarea[name], select[name]')) {
      const k = `${key}|${fieldKey(el)}`;
      if (!drafts.has(k)) continue;
      if (el.type === 'checkbox' || el.type === 'radio') el.checked = drafts.get(k);
      else el.value = drafts.get(k);
    }
  }
}

function showToast(text) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.textContent = `✓ ${text}`;
  el.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => el.classList.remove('show'), 2600);
}

export function parseRoute() {
  const [name, ...rest] = location.hash.replace(/^#\/?/, '').split('/');
  return { name: ROUTES[name] ? name : 'train', params: rest.map(decodeURIComponent) };
}

export function createApp({ root, sync, logout }) {
  const app = {
    model: buildModel(new Map()),
    status: sync.status,
    sync,
    ui: {},
    stale: false,
    skipDraft: null,
    logout,
    toast: showToast,
    go(hash) {
      if (location.hash === hash) app.render(true);
      else location.hash = hash;
    },
    async dispatch(op) {
      await sync.enqueue(op);
      await app.refresh();
    },
    async refresh() {
      app.model = buildModel(await sync.view());
      app.render();
    },
    render(force = false) {
      if (!force && isField(document.activeElement) && root.contains(document.activeElement)) {
        app.stale = true;
        return;
      }
      app.stale = false;
      const drafts = captureDrafts(root, app.skipDraft);
      app.skipDraft = null;
      const r = parseRoute();
      let content;
      try {
        content = ROUTES[r.name](app, r.params);
      } catch (e) {
        console.error(e);
        content = `<section class="card"><p class="warn">Ошибка экрана: ${esc(e.message)}</p><a href="#/train">На главную</a></section>`;
      }
      root.innerHTML = shell(content, r.name, app.status);
      restoreDrafts(root, drafts);
    },
  };

  sync.onChange = (status) => {
    app.status = status;
    const b = root.querySelector('.sync');
    if (b) b.outerHTML = badge(status);
    if (status.state !== 'syncing') app.refresh();
  };

  const call = (name, el, ev) => {
    const fn = ACTIONS[name];
    if (!fn) return;
    if (app.stale) app.stale = false;
    Promise.resolve(fn(app, el, ev)).catch((e) => {
      console.error(e);
      globalThis.alert(`Не получилось: ${e.message}`);
    });
  };

  root.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-act]');
    if (!el || !root.contains(el)) return;
    ev.preventDefault();
    call(el.dataset.act, el, ev);
  });
  root.addEventListener('change', (ev) => {
    const el = ev.target.closest('[data-change]');
    if (!el) return;
    el.blur();
    call(el.dataset.change, el, ev);
  });
  root.addEventListener('submit', (ev) => {
    const form = ev.target.closest('form[data-submit]');
    if (!form) return;
    ev.preventDefault();
    document.activeElement?.blur();
    app.skipDraft = formKey(form);
    call(form.dataset.submit, form, ev);
  });
  // Отложенную перерисовку НЕ делаем при уходе из поля: она срабатывала между нажатием и отпусканием
  // кнопки «Сохранить», и нажатие терялось. Экран обновится при следующем действии или переходе.
  window.addEventListener('hashchange', () => {
    app.render(true);
    window.scrollTo(0, 0);
  });
  document.addEventListener('keydown', (ev) => {
    if (parseRoute().name !== 'run' || isField(document.activeElement)) return;
    if (ev.key === 'ArrowRight') call('runNext');
    if (ev.key === 'ArrowLeft') call('runPrev');
  });
  return app;
}
