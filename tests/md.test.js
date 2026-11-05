import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc, md, safeUrl } from '../js/core/md.js';

test('esc escapes html', () => {
  assert.equal(esc('<b a="1">&\'</b>'), '&lt;b a=&quot;1&quot;&gt;&amp;&#39;&lt;/b&gt;');
  assert.equal(esc(null), '');
});

test('md renders paragraphs, bold, lists and links', () => {
  const html = md('Привет **мир**\n\n- раз\n- два\n\n1. первый\n\n[YouTube](https://youtu.be/x)');
  assert.equal(html, '<p>Привет <strong>мир</strong></p><ul><li>раз</li><li>два</li></ul><ol><li>первый</li></ol><p><a href="https://youtu.be/x" target="_blank" rel="noopener">YouTube</a></p>');
});

test('md never outputs raw html', () => {
  assert.ok(!md('<script>alert(1)</script>').includes('<script>'));
});

test('md renders h3/h4 as h4', () => {
  assert.equal(md('### Заголовок'), '<h4>Заголовок</h4>');
});

test('safeUrl allows only http(s)', () => {
  assert.equal(safeUrl('https://a.ru'), 'https://a.ru');
  assert.equal(safeUrl('javascript:alert(1)'), '#');
});
