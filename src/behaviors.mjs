import fs from 'node:fs';
import path from 'node:path';
import { FIXTURES_DIR } from './paths.mjs';

export function validateManifest(m, dir) {
  const errors = [];
  if (!/^[a-z0-9-]+$/.test(m.id || '')) errors.push('id must be lowercase letters, digits and dashes');
  if (dir && path.basename(dir) !== m.id) errors.push(`id "${m.id}" must match folder "${path.basename(dir)}"`);
  for (const k of ['title', 'summary', 'what_differs']) if (!m[k]) errors.push(`${k} is required`);
  if (!Array.isArray(m.wordings) || !m.wordings.length) errors.push('at least one wording is required');
  const ids = new Set();
  for (const w of m.wordings || []) {
    if (!w.id || !w.text) errors.push('each wording needs id and text');
    if (ids.has(w.id)) errors.push(`duplicate wording id ${w.id}`);
    ids.add(w.id);
  }
  if (dir) for (const f of ['correct.html', 'broken.html']) if (!fs.existsSync(path.join(dir, f))) errors.push(`${f} is missing`);
  return errors;
}

export function loadBehaviors(ids = null) {
  const out = [];
  for (const name of fs.readdirSync(FIXTURES_DIR).sort()) {
    if (name.startsWith('_') || name.startsWith('.')) continue;
    const dir = path.join(FIXTURES_DIR, name);
    const mf = path.join(dir, 'manifest.json');
    if (!fs.existsSync(mf)) continue;
    const m = JSON.parse(fs.readFileSync(mf, 'utf8'));
    m.expected ||= { correct: 'PASS', broken: 'FAIL' };
    m.tags ||= [];
    const errors = validateManifest(m, dir);
    if (errors.length) throw new Error(`fixtures/${name}: ${errors.join('; ')}`);
    if (!ids || ids.includes(m.id)) out.push(m);
  }
  if (ids) for (const id of ids) if (!out.find((b) => b.id === id)) throw new Error(`No behavior named ${id}`);
  return out;
}

export function saveManifest(m) {
  fs.writeFileSync(path.join(FIXTURES_DIR, m.id, 'manifest.json'), JSON.stringify(m, null, 2) + '\n');
}
