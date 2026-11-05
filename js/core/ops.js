import { withMeta, withLink, withNotes } from './trick.js';

function need(text, op) {
  if (text == null) throw new Error(`Нет файла ${op.path}`);
  return text;
}

export function applyOp(text, op) {
  switch (op.type) {
    case 'create':
      return text ?? op.text;
    case 'meta':
      return withMeta(need(text, op), op.patch);
    case 'link':
      return withLink(need(text, op), op.link);
    case 'notes':
      return withNotes(need(text, op), op.notes);
    case 'session': {
      const list = text ? JSON.parse(text) : [];
      if (!list.some((s) => s.id === op.session.id)) list.push(op.session);
      list.sort((a, b) => a.id.localeCompare(b.id));
      return `${JSON.stringify(list, null, 2)}\n`;
    }
    case 'settings': {
      const cur = text ? JSON.parse(text) : {};
      return `${JSON.stringify({ ...cur, ...op.patch }, null, 2)}\n`;
    }
    default:
      throw new Error(`Неизвестная операция ${op.type}`);
  }
}

export function applyQueue(files, queue) {
  const out = new Map([...files].map(([p, f]) => [p, f.text]));
  for (const { op } of queue) {
    try {
      out.set(op.path, applyOp(out.get(op.path) ?? null, op));
    } catch {
      /* операция, которую нельзя применить, не ломает остальные */
    }
  }
  return out;
}
