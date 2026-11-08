import { applyOp, applyQueue } from '../core/ops.js';
import { AuthError, ConflictError, NetworkError } from './github.js';

export const isDataPath = (p) => /^tricks\/[^/]+\/trick\.md$/.test(p) || /^log\/\d{4}-\d{2}\.json$/.test(p) || p === 'settings.json';

function commitMessage(op) {
  switch (op.type) {
    case 'session': return `Тренировка ${op.session.id}`;
    case 'create': return `Новое: ${op.path}`;
    case 'link': return `Ссылка: ${op.path}`;
    case 'notes': return `Заметки: ${op.path}`;
    case 'settings': return 'Настройки';
    case 'delete': return `Удалено: ${op.path}`;
    default: return `Изменение: ${op.path}`;
  }
}

export class Sync {
  constructor({ gh, store, onChange = () => {} }) {
    this.gh = gh;
    this.store = store;
    this.onChange = onChange;
    this.status = { state: 'idle', pending: 0, error: null };
    this.running = null;
  }

  setStatus(patch) {
    this.status = { ...this.status, ...patch };
    this.onChange(this.status);
  }

  async view() {
    const [files, queue] = await Promise.all([this.store.getFiles(), this.store.getQueue()]);
    return applyQueue(files, queue);
  }

  async enqueue(op) {
    await this.store.enqueue(op);
    const q = await this.store.getQueue();
    this.setStatus({ state: 'pending', pending: q.length });
    this.sync();
  }

  sync() {
    if (!this.running) this.running = this.runSync().finally(() => { this.running = null; });
    return this.running;
  }

  async runSync() {
    this.setStatus({ state: 'syncing' });
    try {
      await this.push();
      await this.pull();
      await this.push();
      const q = await this.store.getQueue();
      this.setStatus({ state: q.length ? 'pending' : 'ok', pending: q.length, error: null });
    } catch (e) {
      const q = await this.store.getQueue();
      if (e instanceof AuthError) this.setStatus({ state: 'auth', error: e.message, pending: q.length });
      else if (e instanceof NetworkError) this.setStatus({ state: 'offline', error: null, pending: q.length });
      else this.setStatus({ state: 'error', error: String(e?.message || e), pending: q.length });
    }
  }

  async push() {
    for (;;) {
      const [item] = await this.store.getQueue();
      if (!item) return;
      await this.pushOne(item.op);
      await this.store.dequeue(item.id);
    }
  }

  async pushOne(op, attempt = 0) {
    const remote = await this.gh.getFile(op.path);
    let text;
    try {
      text = applyOp(remote ? remote.text : null, op);
    } catch {
      return; // операцию нельзя применить (файл удалён) — выбрасываем
    }
    if (remote && text === remote.text) {
      await this.store.setFile(op.path, remote.sha, remote.text);
      return;
    }
    try {
      if (text === null) {
        if (remote) await this.gh.deleteFile(op.path, remote.sha, commitMessage(op));
        await this.store.deleteFile(op.path);
      } else {
        const sha = await this.gh.putFile(op.path, text, remote?.sha, commitMessage(op));
        await this.store.setFile(op.path, sha, text);
      }
    } catch (e) {
      if (e instanceof ConflictError && attempt < 3) return this.pushOne(op, attempt + 1);
      throw e;
    }
  }

  async pull() {
    const tree = (await this.gh.getTree()).filter((f) => isDataPath(f.path));
    const local = await this.store.getFiles();
    const remotePaths = new Set(tree.map((f) => f.path));
    const changed = tree.filter((f) => local.get(f.path)?.sha !== f.sha);
    for (let i = 0; i < changed.length; i += 8) {
      const chunk = changed.slice(i, i + 8);
      const texts = await Promise.all(chunk.map((f) => this.gh.getBlob(f.sha)));
      for (let j = 0; j < chunk.length; j++) await this.store.setFile(chunk[j].path, chunk[j].sha, texts[j]);
    }
    for (const path of local.keys()) if (!remotePaths.has(path)) await this.store.deleteFile(path);
  }
}
