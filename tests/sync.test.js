import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from '../js/data/store.js';
import { Sync, isDataPath } from '../js/data/sync.js';
import { AuthError, ConflictError, NetworkError } from '../js/data/github.js';
import { newTrickText, parseTrick } from '../js/core/trick.js';

let n = 0;
class FakeGitHub {
  constructor(files = {}) {
    this.files = new Map(Object.entries(files).map(([p, text]) => [p, { sha: `s${++n}`, text }]));
    this.mode = null;
    this.beforePut = null;
  }
  check() {
    if (this.mode === 'offline') throw new NetworkError('offline');
    if (this.mode === 'auth') throw new AuthError('bad token');
  }
  async getTree() { this.check(); return [...this.files].map(([path, f]) => ({ path, sha: f.sha })); }
  async getBlob(sha) {
    this.check();
    for (const f of this.files.values()) if (f.sha === sha) return f.text;
    throw new Error('no blob');
  }
  async getFile(path) { this.check(); const f = this.files.get(path); return f ? { ...f } : null; }
  async putFile(path, text, sha) {
    this.check();
    if (this.beforePut) { const fn = this.beforePut; this.beforePut = null; fn(this); }
    const cur = this.files.get(path);
    if (cur?.sha !== sha) throw new ConflictError('sha mismatch');
    const next = { sha: `s${++n}`, text };
    this.files.set(path, next);
    return next.sha;
  }
}

const P = 'tricks/a/trick.md';
const A = newTrickText({ name: 'А', status: 'want' });
const setup = (files) => {
  const gh = new FakeGitHub(files);
  const store = new MemoryStore();
  return { gh, store, sync: new Sync({ gh, store }) };
};

test('isDataPath accepts only data files', () => {
  assert.ok(isDataPath(P));
  assert.ok(isDataPath('log/2026-11.json'));
  assert.ok(isDataPath('settings.json'));
  assert.ok(!isDataPath('README.md'));
  assert.ok(!isDataPath('tricks/a/photo.jpg'));
});

test('pull downloads data files only', async () => {
  const { store, sync } = setup({ [P]: A, 'README.md': 'x', 'log/2026-11.json': '[]' });
  await sync.sync();
  assert.deepEqual([...(await store.getFiles()).keys()].sort(), ['log/2026-11.json', P]);
  assert.equal(sync.status.state, 'ok');
});

test('pull removes files deleted on the server', async () => {
  const { gh, store, sync } = setup({ [P]: A, 'tricks/b/trick.md': A });
  await sync.sync();
  gh.files.delete('tricks/b/trick.md');
  await sync.sync();
  assert.deepEqual([...(await store.getFiles()).keys()], [P]);
});

test('enqueue pushes the op and empties the queue', async () => {
  const { gh, store, sync } = setup({ [P]: A });
  await sync.sync();
  await sync.enqueue({ type: 'meta', path: P, patch: { status: 'learning' } });
  await sync.sync();
  assert.equal(parseTrick('a', gh.files.get(P).text).meta.status, 'learning');
  assert.deepEqual(await store.getQueue(), []);
  assert.equal((await store.getFiles()).get(P).sha, gh.files.get(P).sha);
});

test('conflict: remote changed meanwhile → op is re-applied on the fresh file', async () => {
  const L = 'log/2026-11.json';
  const { gh, sync } = setup({ [L]: '[]' });
  await sync.sync();
  gh.beforePut = (g) => g.files.set(L, { sha: 'other', text: JSON.stringify([{ id: '2026-11-01T09:00:00', items: [] }]) });
  await sync.enqueue({ type: 'session', path: L, session: { id: '2026-11-05T10:00:00', items: [] } });
  await sync.sync();
  assert.deepEqual(JSON.parse(gh.files.get(L).text).map((s) => s.id), ['2026-11-01T09:00:00', '2026-11-05T10:00:00']);
  assert.equal(sync.status.state, 'ok');
});

test('offline: op stays queued and is visible in view', async () => {
  const { gh, sync } = setup({ [P]: A });
  await sync.sync();
  gh.mode = 'offline';
  await sync.enqueue({ type: 'meta', path: P, patch: { status: 'learning' } });
  await sync.sync();
  assert.equal(sync.status.state, 'offline');
  assert.equal(sync.status.pending, 1);
  assert.equal(parseTrick('a', (await sync.view()).get(P)).meta.status, 'learning');
  gh.mode = null;
  await sync.sync();
  assert.equal(sync.status.state, 'ok');
  assert.equal(sync.status.pending, 0);
});

test('auth error sets auth state', async () => {
  const { gh, sync } = setup({ [P]: A });
  gh.mode = 'auth';
  await sync.sync();
  assert.equal(sync.status.state, 'auth');
});

test('op that cannot be applied is dropped', async () => {
  const { store, sync } = setup({});
  await sync.enqueue({ type: 'meta', path: 'tricks/zzz/trick.md', patch: { step: 2 } });
  await sync.sync();
  assert.deepEqual(await store.getQueue(), []);
  assert.equal(sync.status.state, 'ok');
});

test('onChange is called with status updates', async () => {
  const { sync } = setup({ [P]: A });
  const seen = [];
  sync.onChange = (s) => seen.push(s.state);
  await sync.sync();
  assert.deepEqual(seen, ['syncing', 'ok']);
});
