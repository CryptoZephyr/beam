// Kane issue URL → a drafted fixture pair in fixtures/_drafts/<id>/. A person approves before anything runs.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { askJson } from './agent.mjs';
import { validateManifest } from './behaviors.mjs';
import { FIXTURES_DIR } from './paths.mjs';

const DRAFTS = path.join(FIXTURES_DIR, '_drafts');

function readIssue(url) {
  const m = String(url).match(/github\.com\/LambdaTest\/kane-cli\/issues\/(\d+)/i);
  if (!m) throw new Error('Use a Kane CLI issue link like https://github.com/LambdaTest/kane-cli/issues/252');
  const n = Number(m[1]);
  const raw = execFileSync('gh', ['issue', 'view', String(n), '-R', 'LambdaTest/kane-cli', '--json', 'title,body'], { encoding: 'utf8' });
  const { title, body } = JSON.parse(raw);
  return { number: n, title, body: body.slice(0, 6000) };
}

function prompt(issue) {
  return `You turn a Kane CLI bug report into a minimal test fixture pair for "Beam".
Kane CLI runs plain-English checks in a real browser. Beam measures whether a check is right: Kane should PASS it on correct.html and FAIL it on broken.html.

Issue #${issue.number}: ${issue.title}
${issue.body}

Write:
- correct.html: a tiny self-contained page (inline CSS/JS only, no network, deterministic, lang="en", <meta charset="utf-8">) where the behavior in the issue works.
- broken.html: the same page with ONE minimal change (1-3 lines) so the check should fail.
- a check wording taken from the issue (the one that misled Kane), starting with "Verify" or "Assert", describing only the expected truth.
- steps: plain-English actions run before the check (or "").
Return ONLY JSON:
{"id":"lowercase-dashed-id","title":"short title","summary":"what the correct page shows","what_differs":"how broken differs","tags":["..."],"steps":"...","wording":"...","correct_html":"...","broken_html":"..."}`;
}

export async function draftFromIssue(url) {
  const issue = readIssue(url);
  const d = await askJson(prompt(issue), (o) => {
    for (const k of ['id', 'title', 'summary', 'what_differs', 'wording', 'correct_html', 'broken_html']) if (!o[k]) return `missing ${k}`;
    if (!/^[a-z0-9-]+$/.test(o.id)) return 'bad id';
    if (o.correct_html === o.broken_html) return 'pages are identical';
    return null;
  });
  if (fs.existsSync(path.join(FIXTURES_DIR, d.id))) d.id = `${d.id}-${issue.number}`;
  const dir = path.join(DRAFTS, d.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'correct.html'), d.correct_html);
  fs.writeFileSync(path.join(dir, 'broken.html'), d.broken_html);
  const manifest = {
    id: d.id, title: d.title, summary: d.summary, tags: d.tags || [], issue: issue.number, what_differs: d.what_differs,
    expected: { correct: 'PASS', broken: 'FAIL' }, steps: d.steps || '',
    wordings: [{ id: 'w1', origin: 'issue', text: d.wording }],
  };
  const errors = validateManifest(manifest, dir);
  if (errors.length) throw new Error(`Draft is invalid: ${errors.join('; ')}`);
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return { ...manifest, correctUrl: `/drafts/${d.id}/correct.html`, brokenUrl: `/drafts/${d.id}/broken.html`, correctHtml: d.correct_html, brokenHtml: d.broken_html };
}

function draftDir(id) {
  if (!/^[a-z0-9-]+$/.test(String(id))) throw new Error('Bad draft id');
  const dir = path.resolve(DRAFTS, id);
  if (!dir.startsWith(path.resolve(DRAFTS) + path.sep)) throw new Error('Bad draft id');
  return dir;
}

export function approveDraft(id) {
  const from = draftDir(id);
  const to = path.join(FIXTURES_DIR, id);
  if (!fs.existsSync(from)) throw new Error(`No draft ${id}`);
  if (fs.existsSync(to)) throw new Error(`fixtures/${id} already exists`);
  fs.renameSync(from, to);
}

export function discardDraft(id) {
  fs.rmSync(draftDir(id), { recursive: true, force: true });
}

// CLI: npm run add-issue -- <url> [--approve]
export async function addIssue(url, flags = {}) {
  console.log('Reading the issue and drafting two pages…');
  const d = await draftFromIssue(url);
  console.log(`Draft: fixtures/_drafts/${d.id}/`);
  console.log(`  ${d.title}\n  correct: ${d.summary}\n  broken:  ${d.what_differs}\n  check:   ${d.wordings[0].text}`);
  if (flags.approve) {
    approveDraft(d.id);
    console.log(`Approved. Run it with: npm run suite -- ${d.id}`);
  } else {
    console.log(`Review both pages, then move the folder to fixtures/${d.id}/ (or rerun with --approve).`);
  }
}
