import { load, dump, JSON_SCHEMA } from '../vendor/js-yaml.mjs';

export const STATUSES = ['want', 'learning', 'reinforcing', 'known'];
export const RELIABILITY = ['home', 'yard', 'park', 'dogs'];
export const TYPES = ['trick', 'game'];

export const DEFAULT_META = {
  name: '',
  commands: [],
  type: 'trick',
  place: 'any',
  props: [],
  status: 'want',
  step: 1,
  reliability: null,
  favorite: false,
  needs_method: false,
  in_plan: true,
  known_since: null,
};

const FM = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/;

export const trickPath = (slug) => `tricks/${slug}/trick.md`;

export function splitFrontmatter(text) {
  const norm = String(text).replace(/\r\n/g, '\n');
  const m = norm.match(FM);
  if (!m) return { meta: {}, body: norm };
  const meta = load(m[1], { schema: JSON_SCHEMA }) || {};
  return { meta, body: norm.slice(m[0].length) };
}

export function joinFrontmatter(meta, body) {
  const yaml = dump(meta, { schema: JSON_SCHEMA, lineWidth: -1, flowLevel: 1 });
  return `---\n${yaml}---\n${body}`;
}

function splitBody(body) {
  const heads = [...body.matchAll(/^## +(.*)$/gm)];
  if (!heads.length) return { pre: body, list: [] };
  const pre = body.slice(0, heads[0].index);
  const list = heads.map((m, i) => {
    const start = m.index + m[0].length;
    const end = i + 1 < heads.length ? heads[i + 1].index : body.length;
    return { title: m[1].trim(), content: body.slice(start, end) };
  });
  return { pre, list };
}

const joinBody = ({ pre, list }) => pre + list.map((s) => `## ${s.title}${s.content}`).join('');

function getSection(text, title) {
  const { body } = splitFrontmatter(text);
  return splitBody(body).list.find((s) => s.title === title)?.content ?? null;
}

function setSection(text, title, content, before) {
  const { meta, body } = splitFrontmatter(text);
  const b = splitBody(body);
  const existing = b.list.find((s) => s.title === title);
  if (existing) {
    existing.content = content;
  } else {
    const at = before ? b.list.findIndex((s) => s.title === before) : -1;
    if (at === -1) {
      if (b.list.length) {
        const last = b.list[b.list.length - 1];
        last.content = last.content.replace(/\s*$/, '\n\n');
      } else {
        b.pre = b.pre.trim() ? b.pre.replace(/\s*$/, '\n\n') : '\n';
      }
      b.list.push({ title, content });
    } else {
      b.list.splice(at, 0, { title, content });
    }
  }
  return joinFrontmatter(meta, joinBody(b));
}

export function withMeta(text, patch) {
  const { meta, body } = splitFrontmatter(text);
  const merged = { ...meta, ...patch };
  for (const k of Object.keys(merged)) if (merged[k] === undefined) delete merged[k];
  return joinFrontmatter(merged, body);
}

export function linkTitle(url) {
  let host;
  try {
    host = new URL(url).hostname.replace(/^(www|m)\./, '');
  } catch {
    return url;
  }
  if (/(^|\.)youtube\.com$/.test(host) || host === 'youtu.be') return 'YouTube';
  if (/(^|\.)instagram\.com$/.test(host)) return 'Instagram';
  if (/(^|\.)facebook\.com$/.test(host) || host === 'fb.watch') return 'Facebook';
  if (/(^|\.)tiktok\.com$/.test(host)) return 'TikTok';
  if (/(^|\.)vk\.com$/.test(host)) return 'VK';
  return host;
}

const clean = (s) => String(s || '').replace(/[[\]\n]/g, ' ').trim();

export function linkLine({ url, title, note }) {
  const href = String(url).trim();
  return `- [${clean(title) || linkTitle(href)}](${href})${clean(note) ? ` — ${clean(note)}` : ''}`;
}

export function withLink(text, link) {
  const line = linkLine(link);
  const current = getSection(text, 'Ссылки');
  const base = current ? current.replace(/\s*$/, '') : '';
  return setSection(text, 'Ссылки', `${base}\n${line}\n\n`, 'Заметки');
}

export function withNotes(text, notes) {
  return setSection(text, 'Заметки', `\n${String(notes).trim()}\n\n`);
}

// Заголовки ## и ### внутри текста сломали бы разбор файла — убираем решётки в начале строк.
const plain = (s) => String(s || '').replace(/^#{2,}\s*/gm, '').trim();
const oneLine = (s) => String(s || '').replace(/\s+/g, ' ').replace(/^#+\s*/, '').trim();

// Собирает файл трюка целиком из полей формы «Редактировать».
export function buildTrickText(meta, { description = '', steps = [], extra = [], links = [], notes = '' } = {}) {
  let body = '\n';
  if (plain(description)) body += `## Описание\n${plain(description)}\n\n`;
  if (steps.length) {
    body += `## Шаги\n\n${steps.map((s, i) => `### ${i + 1}. ${oneLine(s.title) || `Шаг ${i + 1}`}\n${plain(s.body)}\n`).join('\n')}\n`;
  }
  for (const x of extra) body += `## ${oneLine(x.title) || 'Раздел'}\n${plain(x.md)}\n\n`;
  body += `## Ссылки\n${links.map((l) => `${linkLine(l)}\n`).join('')}\n## Заметки\n${plain(notes) ? `${plain(notes)}\n` : ''}`;
  const out = {};
  for (const [k, v] of Object.entries(meta)) if (v !== undefined && v !== null) out[k] = v;
  return joinFrontmatter(out, body);
}

export function newTrickText(meta) {
  const m = { ...DEFAULT_META, ...meta };
  const out = {};
  for (const k of Object.keys(DEFAULT_META)) if (m[k] !== null && m[k] !== undefined) out[k] = m[k];
  return joinFrontmatter(out, '\n## Ссылки\n\n## Заметки\n');
}

export function parseSteps(md) {
  if (!md) return [];
  return md.split(/^### +/m).slice(1).map((chunk) => {
    const nl = chunk.indexOf('\n');
    const head = nl === -1 ? chunk : chunk.slice(0, nl);
    return {
      title: head.trim().replace(/^\d+[.)]\s*/, ''),
      body: nl === -1 ? '' : chunk.slice(nl + 1).trim(),
    };
  });
}

const LINK = /^[-*]\s+\[([^\]]*)\]\((\S+?)\)\s*(?:[—–-]\s*(.*))?$/;

export function parseLinks(md) {
  if (!md) return [];
  return md
    .split('\n')
    .map((l) => l.trim().match(LINK))
    .filter(Boolean)
    .map((m) => ({ title: m[1], url: m[2], note: (m[3] || '').trim() }));
}

const KNOWN_SECTIONS = new Set(['Описание', 'Шаги', 'Ссылки', 'Заметки']);

const toList = (v) => (Array.isArray(v) ? v.map(String) : v ? [String(v)] : []);

function normalizeMeta(raw, slug) {
  const m = { ...DEFAULT_META, ...raw };
  if (!m.name) m.name = slug;
  m.name = String(m.name);
  m.commands = toList(m.commands);
  m.props = toList(m.props);
  m.step = Number.isInteger(m.step) && m.step > 0 ? m.step : 1;
  if (!STATUSES.includes(m.status)) m.status = 'want';
  if (!TYPES.includes(m.type)) m.type = 'trick'; // старый тип «project» и опечатки — это трюк
  if (m.known_since != null) m.known_since = String(m.known_since);
  return m;
}

export function parseTrick(slug, text) {
  try {
    const { meta, body } = splitFrontmatter(text);
    const sec = new Map(splitBody(body).list.map((s) => [s.title, s.content.trim()]));
    return {
      slug,
      meta: normalizeMeta(meta, slug),
      description: sec.get('Описание') || '',
      steps: parseSteps(sec.get('Шаги')),
      links: parseLinks(sec.get('Ссылки')),
      notes: sec.get('Заметки') || '',
      extra: [...sec].filter(([k]) => !KNOWN_SECTIONS.has(k)).map(([title, md]) => ({ title, md })),
      error: null,
    };
  } catch (e) {
    return {
      slug, meta: normalizeMeta({}, slug), description: '', steps: [], links: [], notes: '', extra: [],
      error: String(e.message || e),
    };
  }
}

const TR = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

export function slugify(name) {
  const s = String(name).toLowerCase().split('').map((c) => TR[c] ?? c).join('')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s || 'trick';
}

export function uniqueSlug(name, existing) {
  const base = slugify(name);
  let s = base;
  for (let i = 2; existing.has(s); i++) s = `${base}-${i}`;
  return s;
}
