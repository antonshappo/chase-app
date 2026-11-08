export class AuthError extends Error {}
export class ConflictError extends Error {}
export class NetworkError extends Error {}

export function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function b64decode(b64) {
  const bin = atob(String(b64).replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

const encodePath = (p) => p.split('/').map(encodeURIComponent).join('/');

export class GitHub {
  constructor({ token, owner, repo, branch = 'main', fetch: f }) {
    this.token = token;
    this.owner = owner;
    this.repo = repo;
    this.branch = branch;
    this.fetch = f || ((...a) => globalThis.fetch(...a));
  }

  async req(method, path, body) {
    let res;
    try {
      res = await this.fetch(`https://api.github.com/repos/${this.owner}/${this.repo}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store',
      });
    } catch (e) {
      throw new NetworkError(String(e?.message || e));
    }
    if (res.status === 401 || res.status === 403) {
      throw new AuthError(`Ключ не подошёл или у него нет прав (GitHub ${res.status})`);
    }
    return res;
  }

  async checkAccess() {
    const r = await this.req('GET', '');
    if (r.status === 404) throw new AuthError('Репозиторий не найден или у ключа нет к нему доступа');
    if (!r.ok) throw new Error(`GitHub ${r.status}`);
    return true;
  }

  async getTree() {
    const r = await this.req('GET', `/git/trees/${this.branch}?recursive=1`);
    if (!r.ok) throw new Error(`Не удалось прочитать репозиторий (GitHub ${r.status})`);
    const j = await r.json();
    return j.tree.filter((x) => x.type === 'blob').map(({ path, sha }) => ({ path, sha }));
  }

  async getBlob(sha) {
    const r = await this.req('GET', `/git/blobs/${sha}`);
    if (!r.ok) throw new Error(`Не удалось скачать файл (GitHub ${r.status})`);
    return b64decode((await r.json()).content);
  }

  async getFile(path) {
    const r = await this.req('GET', `/contents/${encodePath(path)}?ref=${this.branch}`);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`Не удалось прочитать ${path} (GitHub ${r.status})`);
    const j = await r.json();
    return { sha: j.sha, text: b64decode(j.content) };
  }

  async deleteFile(path, sha, message) {
    const r = await this.req('DELETE', `/contents/${encodePath(path)}`, { message, sha, branch: this.branch });
    if (r.status === 404) return;
    if (r.status === 409 || r.status === 422) throw new ConflictError(`Файл ${path} изменился на сервере`);
    if (!r.ok) throw new Error(`Не удалось удалить ${path} (GitHub ${r.status})`);
  }

  async putFile(path, text, sha, message) {
    const r = await this.req('PUT', `/contents/${encodePath(path)}`, {
      message, content: b64encode(text), branch: this.branch, ...(sha ? { sha } : {}),
    });
    if (r.status === 409 || r.status === 422) throw new ConflictError(`Файл ${path} изменился на сервере`);
    if (!r.ok) throw new Error(`Не удалось сохранить ${path} (GitHub ${r.status})`);
    return (await r.json()).content.sha;
  }
}
