import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTrick, withMeta, withLink, withNotes, newTrickText, slugify, uniqueSlug, linkTitle, splitFrontmatter, trickPath, buildTrickText,
} from '../js/core/trick.js';

const SAMPLE = `---
name: Пятка и носок
commands: [Пятка, Носок]
type: trick
place: home
props: [treats]
status: learning
step: 2
---

## Описание
Подаёт заднюю лапу.

## Шаги

### 1. Касание лапы
Коснись лапы. **Повторы:** 5–8.

### 2. Поднять лапу
Ждём, пока поднимет.

## Ссылки
- [YouTube](https://youtu.be/abc) — хорошо видно ладонь

## Заметки
Любит курицу.
`;

test('parseTrick reads meta, steps, links, notes', () => {
  const t = parseTrick('zadnie-lapy', SAMPLE);
  assert.equal(t.error, null);
  assert.equal(t.meta.name, 'Пятка и носок');
  assert.deepEqual(t.meta.commands, ['Пятка', 'Носок']);
  assert.equal(t.meta.step, 2);
  assert.equal(t.meta.favorite, false);
  assert.equal(t.meta.in_plan, true);
  assert.equal(t.steps.length, 2);
  assert.equal(t.steps[0].title, 'Касание лапы');
  assert.match(t.steps[0].body, /Повторы/);
  assert.deepEqual(t.links, [{ title: 'YouTube', url: 'https://youtu.be/abc', note: 'хорошо видно ладонь' }]);
  assert.equal(t.notes, 'Любит курицу.');
  assert.equal(t.description, 'Подаёт заднюю лапу.');
  assert.deepEqual(t.extra, []);
});

test('parseTrick keeps unknown sections as extra', () => {
  const t = parseTrick('g', '---\nname: Игра\ntype: game\n---\n\n## Описание\nТекст\n\n## Усложнения\n- быстрее\n');
  assert.deepEqual(t.extra, [{ title: 'Усложнения', md: '- быстрее' }]);
});

test('parseTrick does not crash on broken yaml', () => {
  const t = parseTrick('bad', '---\nname: [oops\n---\n');
  assert.ok(t.error);
  assert.equal(t.meta.name, 'bad');
});

test('dates in frontmatter stay strings', () => {
  const t = parseTrick('x', '---\nname: X\nknown_since: 2026-11-05\n---\n');
  assert.equal(t.meta.known_since, '2026-11-05');
});

test('invalid status and step are normalized', () => {
  const t = parseTrick('x', '---\nname: X\nstatus: wat\nstep: 0\ncommands: Сидеть\n---\n');
  assert.equal(t.meta.status, 'want');
  assert.equal(t.meta.step, 1);
  assert.deepEqual(t.meta.commands, ['Сидеть']);
});

test('withMeta changes only frontmatter', () => {
  const out = withMeta(SAMPLE, { step: 3 });
  assert.equal(parseTrick('z', out).meta.step, 3);
  assert.equal(splitFrontmatter(out).body, splitFrontmatter(SAMPLE).body);
});

test('withLink appends to existing links section', () => {
  const out = withLink(SAMPLE, { url: 'https://instagram.com/p/1', title: 'Instagram', note: '' });
  const t = parseTrick('z', out);
  assert.equal(t.links.length, 2);
  assert.deepEqual(t.links[1], { title: 'Instagram', url: 'https://instagram.com/p/1', note: '' });
  assert.equal(t.notes, 'Любит курицу.');
});

test('withLink creates section before notes when missing and guesses title', () => {
  const src = '---\nname: X\n---\n\n## Заметки\nтекст\n';
  const out = withLink(src, { url: 'https://youtu.be/x' });
  assert.ok(out.indexOf('## Ссылки') < out.indexOf('## Заметки'));
  const t = parseTrick('x', out);
  assert.deepEqual(t.links, [{ title: 'YouTube', url: 'https://youtu.be/x', note: '' }]);
  assert.equal(t.notes, 'текст');
});

test('withLink appends section at end when there are no sections', () => {
  const t = parseTrick('x', withLink('---\nname: X\n---\nпросто текст', { url: 'https://a.ru/1', note: 'хорошо' }));
  assert.deepEqual(t.links, [{ title: 'a.ru', url: 'https://a.ru/1', note: 'хорошо' }]);
});

test('withNotes replaces notes and keeps links', () => {
  const t = parseTrick('z', withNotes(SAMPLE, 'Новое'));
  assert.equal(t.notes, 'Новое');
  assert.equal(t.links.length, 1);
});

test('newTrickText round-trips', () => {
  const t = parseTrick('obnimi', newTrickText({ name: 'Обними', status: 'want', needs_method: true }));
  assert.equal(t.error, null);
  assert.equal(t.meta.name, 'Обними');
  assert.equal(t.meta.needs_method, true);
  assert.equal(t.meta.reliability, null);
});

test('slugify transliterates and uniqueSlug avoids collisions', () => {
  assert.equal(slugify('Ко мне!'), 'ko-mne');
  assert.equal(slugify('Пятка и носок'), 'pyatka-i-nosok');
  assert.equal(slugify('!!!'), 'trick');
  assert.equal(uniqueSlug('Ко мне', new Set(['ko-mne'])), 'ko-mne-2');
  assert.equal(trickPath('ko-mne'), 'tricks/ko-mne/trick.md');
});

test('linkTitle guesses source', () => {
  assert.equal(linkTitle('https://www.youtube.com/watch?v=1'), 'YouTube');
  assert.equal(linkTitle('https://youtu.be/1'), 'YouTube');
  assert.equal(linkTitle('https://www.instagram.com/reel/1'), 'Instagram');
  assert.equal(linkTitle('https://m.facebook.com/x'), 'Facebook');
  assert.equal(linkTitle('https://dogtrick.ru/a'), 'dogtrick.ru');
  assert.equal(linkTitle('не ссылка'), 'не ссылка');
});

test('legacy and unknown types are read as trick', () => {
  assert.equal(parseTrick('x', '---\nname: X\ntype: project\n---\n').meta.type, 'trick');
  assert.equal(parseTrick('x', '---\nname: X\ntype: game\n---\n').meta.type, 'game');
});

test('buildTrickText writes every section and round-trips', () => {
  const content = {
    description: 'Описание **важное**',
    steps: [{ title: 'Первый', body: 'Делай раз' }, { title: '', body: 'Без названия' }],
    extra: [{ title: 'Частые ошибки', md: '- спешка' }],
    links: [{ title: 'YouTube', url: 'https://youtu.be/1', note: 'видно ладонь' }, { title: '', url: 'https://a.ru/x', note: '' }],
    notes: 'Любит сыр',
  };
  const t = parseTrick('x', buildTrickText({ name: 'X', status: 'learning', step: 2 }, content));
  assert.equal(t.error, null);
  assert.equal(t.meta.status, 'learning');
  assert.equal(t.meta.step, 2);
  assert.equal(t.description, 'Описание **важное**');
  assert.deepEqual(t.steps, [{ title: 'Первый', body: 'Делай раз' }, { title: 'Шаг 2', body: 'Без названия' }]);
  assert.deepEqual(t.extra, [{ title: 'Частые ошибки', md: '- спешка' }]);
  assert.deepEqual(t.links, [{ title: 'YouTube', url: 'https://youtu.be/1', note: 'видно ладонь' }, { title: 'a.ru', url: 'https://a.ru/x', note: '' }]);
  assert.equal(t.notes, 'Любит сыр');
});

test('buildTrickText neutralizes headings typed inside texts', () => {
  const t = parseTrick('x', buildTrickText({ name: 'X' }, { steps: [{ title: 'A', body: '### не шаг\n## не раздел' }], notes: '## тоже' }));
  assert.equal(t.steps.length, 1);
  assert.match(t.steps[0].body, /не шаг/);
  assert.equal(t.extra.length, 0);
  assert.match(t.notes, /тоже/);
});
