export class MemoryStore {
  constructor() {
    this.files = new Map();
    this.queue = [];
    this.seq = 0;
  }
  async getFiles() { return new Map(this.files); }
  async setFile(path, sha, text) { this.files.set(path, { sha, text }); }
  async deleteFile(path) { this.files.delete(path); }
  async getQueue() { return this.queue.slice(); }
  async enqueue(op) { this.queue.push({ id: ++this.seq, op }); }
  async dequeue(id) { this.queue = this.queue.filter((q) => q.id !== id); }
  async clear() { this.files.clear(); this.queue = []; }
}

function openDb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('chase', 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      db.createObjectStore('files', { keyPath: 'path' });
      db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function run(db, names, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(names, mode);
    const req = fn(t);
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export class IdbStore {
  constructor() { this.db = openDb(); }
  async getFiles() {
    const all = await run(await this.db, 'files', 'readonly', (t) => t.objectStore('files').getAll());
    return new Map(all.map((f) => [f.path, { sha: f.sha, text: f.text }]));
  }
  async setFile(path, sha, text) {
    await run(await this.db, 'files', 'readwrite', (t) => { t.objectStore('files').put({ path, sha, text }); });
  }
  async deleteFile(path) {
    await run(await this.db, 'files', 'readwrite', (t) => { t.objectStore('files').delete(path); });
  }
  async getQueue() {
    return run(await this.db, 'queue', 'readonly', (t) => t.objectStore('queue').getAll());
  }
  async enqueue(op) {
    await run(await this.db, 'queue', 'readwrite', (t) => { t.objectStore('queue').add({ op }); });
  }
  async dequeue(id) {
    await run(await this.db, 'queue', 'readwrite', (t) => { t.objectStore('queue').delete(id); });
  }
  async clear() {
    await run(await this.db, ['files', 'queue'], 'readwrite', (t) => {
      t.objectStore('files').clear();
      t.objectStore('queue').clear();
    });
  }
}
