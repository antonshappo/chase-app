import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildModel } from '../js/core/model.js';
import { newTrickText } from '../js/core/trick.js';
import { shell } from '../js/ui/views/layout.js';
import { loginView } from '../js/ui/views/login.js';
import * as train from '../js/ui/views/train.js';
import * as run from '../js/ui/views/run.js';
import * as library from '../js/ui/views/library.js';
import * as trick from '../js/ui/views/trick.js';
import * as add from '../js/ui/views/add.js';
import * as progress from '../js/ui/views/progress.js';
import * as settings from '../js/ui/views/settings.js';

const learn = `${newTrickText({ name: 'Пятка <b>', status: 'learning', step: 1, commands: ['Пятка'] })}\n## Шаги\n\n### 1. Касание\nКоснись **лапы**.\n`;
const files = new Map([
  ['tricks/sidet/trick.md', newTrickText({ name: 'Сидеть', status: 'known', favorite: true })],
  ['tricks/lezhat/trick.md', newTrickText({ name: 'Лежать', status: 'known', reliability: 'yard' })],
  ['tricks/bochka/trick.md', newTrickText({ name: 'Бочка', status: 'known' })],
  ['tricks/pyatka/trick.md', learn],
  ['tricks/zamri/trick.md', newTrickText({ name: 'Замри', status: 'reinforcing', reliability: 'home' })],
  ['tricks/igra/trick.md', newTrickText({ name: 'Напёрстки', type: 'game', place: 'home', status: 'known' })],
  ['tricks/obnimi/trick.md', newTrickText({ name: 'Обними', status: 'want', needs_method: true })],
  ['log/2026-11.json', JSON.stringify([{ id: '2026-11-02T10:00:00', place: 'home', items: [{ trick: 'pyatka', block: 'new', step: 1, result: 'good' }] }])],
]);
const app = () => ({ model: buildModel(files), status: { state: 'ok', pending: 0, error: null }, ui: {} });

test('every screen renders a string', () => {
  const a = app();
  for (const html of [
    train.view(a), library.view(a), trick.view(a, ['pyatka']), trick.view(a, ['nope']), add.view(a),
    progress.view(a), settings.view(a), run.view(a), run.doneView(a), loginView('o/r', 'err'),
  ]) {
    assert.equal(typeof html, 'string');
    assert.ok(html.length > 20);
  }
  assert.match(shell('<p>x</p>', 'trick', a.status), /class="on"><span aria-hidden="true">📚/);
});

test('names are escaped', () => {
  assert.ok(!library.view(app()).includes('Пятка <b>'));
  assert.ok(library.view(app()).includes('Пятка &lt;b&gt;'));
});

test('run view renders every block kind', () => {
  const a = app();
  const cards = [
    { block: 'warmup', slugs: ['sidet', 'lezhat'] },
    { block: 'new', slugs: ['pyatka'], step: 1 },
    { block: 'pick', slugs: [], options: ['obnimi'] },
    { block: 'repeat', slugs: ['zamri'], tryLevel: 'yard' },
    { block: 'chain', slugs: ['sidet', 'lezhat', 'bochka'] },
    { block: 'game', slugs: ['igra'] },
    { block: 'finale', slugs: ['sidet'] },
    { block: 'repeat', slugs: ['deleted'] },
  ];
  cards.forEach((_, index) => {
    a.ui.run = { plan: { place: 'outdoor', minutes: 20, cards }, index, results: {}, startedAt: '2026-11-05T10:00:00' };
    assert.equal(typeof run.view(a), 'string');
  });
  a.ui.run.index = 1;
  assert.match(run.view(a), /<strong>лапы<\/strong>/);
});

test('train view shows a built plan', () => {
  const a = app();
  train.actions.trainBuild({ ...a, render() {} });
  a.ui.plan = a.ui.plan || { place: 'home', minutes: 20, cards: [{ block: 'pick', slugs: [], options: ['obnimi'] }] };
  assert.match(train.view(a), /План:/);
});
