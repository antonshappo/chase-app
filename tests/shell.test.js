import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

test('service worker SHELL lists every app file and nothing missing', () => {
  const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  const list = JSON.parse(sw.match(/const SHELL = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"'));
  for (const p of list) if (p !== './') assert.ok(existsSync(join(ROOT, p)), `${p} does not exist`);
  for (const f of walk(join(ROOT, 'js'))) {
    const rel = `./${relative(ROOT, f).split('\\').join('/')}`;
    assert.ok(list.includes(rel), `${rel} missing in SHELL`);
  }
});

test('manifest is valid and points to existing icons', () => {
  const m = JSON.parse(readFileSync(join(ROOT, 'manifest.webmanifest'), 'utf8'));
  assert.equal(m.short_name, 'Чейз');
  for (const i of m.icons) assert.ok(existsSync(join(ROOT, i.src)), i.src);
});
