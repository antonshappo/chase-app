import { esc } from '../../core/md.js';

const TABS = [
  ['train', '🐾', 'Тренировка'],
  ['library', '📚', 'Библиотека'],
  ['add', '➕', 'Добавить'],
  ['progress', '📈', 'Прогресс'],
];

const STATE = {
  idle: '☁️',
  ok: '☁️ Сохранено',
  syncing: '🔄 Синхронизация…',
  pending: '⏳ Ждёт отправки',
  offline: '📴 Офлайн',
  error: '⚠️ Ошибка',
  auth: '🔑 Нужен ключ',
};

export function badge(s) {
  const n = s.pending && s.state !== 'ok' ? ` (${s.pending})` : '';
  return `<button class="sync sync-${esc(s.state)}" data-act="sync" title="${esc(s.error || 'Синхронизировать сейчас')}">${STATE[s.state] || ''}${n}</button>`;
}

export function shell(content, route, status) {
  const active = { trick: 'library', edit: 'library', run: 'train', done: 'train', settings: '' }[route] ?? route;
  return `<div class="layout">
  <header class="top"><a class="logo" href="#/train">🐕 Чейз</a>${badge(status)}<a class="icon-btn" href="#/settings" aria-label="Настройки">⚙️</a></header>
  <nav class="tabs">${TABS.map(([r, i, t]) => `<a href="#/${r}" class="${active === r ? 'on' : ''}"><span aria-hidden="true">${i}</span><small>${t}</small></a>`).join('')}</nav>
  <main class="main">${content}</main>
</div>`;
}
