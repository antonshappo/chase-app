import { GitHub } from './data/github.js';
import { IdbStore } from './data/store.js';
import { Sync } from './data/sync.js';
import { createApp } from './ui/app.js';
import { loginView } from './ui/views/login.js';

const KEY_TOKEN = 'chase.token';
const KEY_REPO = 'chase.repo';
const DEFAULT_REPO = 'antonshappo/chase-data';
const root = document.getElementById('app');

const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* недоступно */ } },
};

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});

function captureShare() {
  const q = new URLSearchParams(location.search);
  const raw = ['url', 'text', 'title'].map((k) => q.get(k)).filter(Boolean).join(' ');
  const url = raw.match(/https?:\/\/\S+/)?.[0];
  if (!url && !q.toString()) return;
  if (url) {
    try { sessionStorage.setItem('chase.share', JSON.stringify(url)); } catch { /* недоступно */ }
  }
  history.replaceState(null, '', `${location.pathname}${url ? '#/add' : location.hash}`);
}

async function start() {
  const token = ls.get(KEY_TOKEN);
  const repo = ls.get(KEY_REPO) || DEFAULT_REPO;
  if (!token) {
    showLogin(repo);
    return;
  }
  const [owner, name] = repo.split('/');
  const store = new IdbStore();
  const sync = new Sync({ gh: new GitHub({ token, owner, repo: name }), store });
  const app = createApp({
    root,
    sync,
    logout: async () => {
      ls.set(KEY_TOKEN, null);
      await store.clear();
      location.hash = '';
      location.reload();
    },
  });
  await app.refresh();
  sync.sync();
  window.addEventListener('online', () => sync.sync());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') sync.sync();
  });
}

function showLogin(repo, error = '') {
  root.innerHTML = loginView(repo, error);
  root.querySelector('form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    const repoVal = String(f.get('repo')).trim();
    const token = String(f.get('token')).trim();
    const [owner, name] = repoVal.split('/');
    const btn = ev.target.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Проверяю…';
    try {
      if (!owner || !name) throw new Error('Репозиторий пишется так: владелец/название');
      await new GitHub({ token, owner, repo: name }).checkAccess();
      if (repoVal !== ls.get(KEY_REPO)) await new IdbStore().clear();
      ls.set(KEY_TOKEN, token);
      ls.set(KEY_REPO, repoVal);
      start();
    } catch (e) {
      showLogin(repoVal, e.message || String(e));
    }
  });
}

captureShare();
start();
