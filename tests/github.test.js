import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GitHub, AuthError, ConflictError, NetworkError, b64encode, b64decode } from '../js/data/github.js';

function fakeFetch(handler) {
  const calls = [];
  const f = async (url, opts = {}) => {
    calls.push({ url, ...opts });
    const r = handler(url, opts);
    if (r instanceof Error) throw r;
    const { status = 200, body = {} } = r || {};
    return { status, ok: status >= 200 && status < 300, json: async () => body };
  };
  f.calls = calls;
  return f;
}
const gh = (fetch) => new GitHub({ token: 'T', owner: 'o', repo: 'r', fetch });

test('base64 round-trips cyrillic', () => {
  assert.equal(b64decode(b64encode('Чейз 🐕')), 'Чейз 🐕');
  assert.equal(b64decode(`${b64encode('abc')}\n`), 'abc');
});

test('getFile decodes content and sends auth header', async () => {
  const f = fakeFetch(() => ({ body: { sha: 's1', content: b64encode('Привет') } }));
  assert.deepEqual(await gh(f).getFile('tricks/a/trick.md'), { sha: 's1', text: 'Привет' });
  assert.equal(f.calls[0].url, 'https://api.github.com/repos/o/r/contents/tricks/a/trick.md?ref=main');
  assert.equal(f.calls[0].headers.Authorization, 'Bearer T');
});

test('getFile returns null on 404', async () => {
  assert.equal(await gh(fakeFetch(() => ({ status: 404 }))).getFile('x'), null);
});

test('putFile sends base64 + sha and returns new sha', async () => {
  const f = fakeFetch(() => ({ body: { content: { sha: 's2' } } }));
  assert.equal(await gh(f).putFile('log/2026-11.json', '[]', 's1', 'msg'), 's2');
  const body = JSON.parse(f.calls[0].body);
  assert.equal(f.calls[0].method, 'PUT');
  assert.deepEqual(body, { message: 'msg', content: b64encode('[]'), branch: 'main', sha: 's1' });
});

test('putFile without sha omits it (new file)', async () => {
  const f = fakeFetch(() => ({ status: 201, body: { content: { sha: 's9' } } }));
  await gh(f).putFile('x', 'y', undefined, 'm');
  assert.equal('sha' in JSON.parse(f.calls[0].body), false);
});

test('409/422 → ConflictError, 401/403 → AuthError, fetch failure → NetworkError', async () => {
  await assert.rejects(gh(fakeFetch(() => ({ status: 409 }))).putFile('x', 'y', 's', 'm'), ConflictError);
  await assert.rejects(gh(fakeFetch(() => ({ status: 422 }))).putFile('x', 'y', 's', 'm'), ConflictError);
  await assert.rejects(gh(fakeFetch(() => ({ status: 401 }))).getFile('x'), AuthError);
  await assert.rejects(gh(fakeFetch(() => ({ status: 403 }))).getTree(), AuthError);
  await assert.rejects(gh(fakeFetch(() => new TypeError('Failed to fetch'))).getFile('x'), NetworkError);
});

test('getTree returns only blobs', async () => {
  const f = fakeFetch(() => ({ body: { tree: [{ path: 'tricks', type: 'tree', sha: 't' }, { path: 'tricks/a/trick.md', type: 'blob', sha: 'b' }] } }));
  assert.deepEqual(await gh(f).getTree(), [{ path: 'tricks/a/trick.md', sha: 'b' }]);
  assert.match(f.calls[0].url, /git\/trees\/main\?recursive=1$/);
});

test('getBlob decodes', async () => {
  assert.equal(await gh(fakeFetch(() => ({ body: { content: b64encode('ок') } }))).getBlob('b'), 'ок');
});

test('checkAccess: 404 means no access', async () => {
  await assert.rejects(gh(fakeFetch(() => ({ status: 404 }))).checkAccess(), AuthError);
  assert.equal(await gh(fakeFetch(() => ({ body: {} }))).checkAccess(), true);
});
