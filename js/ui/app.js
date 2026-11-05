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
    logout,
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
      const r = parseRoute();
      let content;
      try {
        content = ROUTES[r.name](app, r.params);
      } catch (e) {
        console.error(e);
        content = `<section class="card"><p class="warn">Ошибка экрана: ${esc(e.message)}</p><a href="#/train">На главную</a></section>`;
      }
      root.innerHTML = shell(content, r.name, app.status);
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
    if (el.type !== 'checkbox') el.blur();
    call(el.dataset.change, el, ev);
  });
  root.addEventListener('submit', (ev) => {
    const form = ev.target.closest('form[data-submit]');
    if (!form) return;
    ev.preventDefault();
    document.activeElement?.blur();
    call(form.dataset.submit, form, ev);
  });
  root.addEventListener('focusout', () => setTimeout(() => {
    if (app.stale && !isField(document.activeElement)) app.render();
  }, 0));
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
