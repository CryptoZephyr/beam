// Before/after: the same Claude Code task with and without Beam, on a todo app with a real plural bug.
// 1. Claude Code writes a Kane test for the counter. 2. Kane runs it against the buggy app.
// 3. If Kane fails, Claude Code gets Kane's result and fixes the app, and Kane runs the test again.
// Usage: node demo/plural-todo/run.mjs [without|with|both]
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { referenceKane } from '../../src/versions.mjs';
import { runTest, verdictOf } from '../../src/kane.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const OUT = path.join(HERE, 'runs');
const PORT = 4319;
const TASK = fs.readFileSync(path.join(HERE, 'TASK.md'), 'utf8');
const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);

function serve(dir) {
  const server = http.createServer((req, res) => {
    const p = req.url === '/' ? '/index.html' : decodeURIComponent(req.url.split('?')[0]);
    const f = path.join(dir, p);
    if (!f.startsWith(dir) || !fs.existsSync(f)) return res.writeHead(404).end('not found');
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(fs.readFileSync(f));
  });
  return new Promise((r) => server.listen(PORT, '127.0.0.1', () => r(server)));
}

function claude(cwd, prompt) {
  return new Promise((resolve) => {
    const args = ['-p', prompt, '--output-format', 'json', '--permission-mode', 'acceptEdits', '--allowedTools', 'Read,Write,Edit,Glob'];
    const child = spawn('claude', args, { cwd, shell: false, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.on('close', () => {
      try { resolve(JSON.parse(out).result || ''); } catch { resolve(out); }
    });
  });
}

async function variant(name) {
  const dir = path.join(OUT, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.cpSync(path.join(HERE, 'app'), path.join(dir, 'app'), { recursive: true });
  if (name === 'with') {
    // The same files `npx kane-beam install` writes, at project level so only this run sees them.
    const skillDir = path.join(dir, '.claude', 'skills', 'kane-beam');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'skill', 'SKILL.md'), path.join(skillDir, 'SKILL.md'));
    fs.copyFileSync(path.join(ROOT, 'beam.json'), path.join(skillDir, 'beam.json'));
  }
  const record = { variant: name, steps: [] };
  const server = await serve(path.join(dir, 'app'));
  try {
    log(`[${name}] Claude Code writes the Kane test…`);
    const said = await claude(dir, TASK);
    const testFile = path.join(dir, 'app', 'counter_test.md');
    const test = fs.existsSync(testFile) ? fs.readFileSync(testFile, 'utf8') : null;
    record.steps.push({ step: 'agent wrote test', agentSaid: said.slice(0, 1500), test });
    log(`[${name}] test written:\n${test}`);
    if (!test) throw new Error('agent did not write the test');

    const kane = referenceKane();
    log(`[${name}] Kane runs the test against the app (it has the plural bug)…`);
    let r = await runTest(kane, testFile, { onStep: (s) => log(`   kane: ${s}`) });
    let v = verdictOf(r);
    record.steps.push({ step: 'kane on buggy app', verdict: v, summary: r.summary, codeJs: r.codeJs, credits: r.credits, testUrl: r.testUrl });
    log(`[${name}] Kane: ${v}. ${String(r.summary || '').replace(/\s+/g, ' ').slice(0, 200)}`);

    if (v === 'FAIL') {
      log(`[${name}] Kane's failure goes back to Claude Code…`);
      const fixSaid = await claude(dir, `Kane CLI ran app/counter_test.md against the app and it FAILED. Kane's summary:\n${r.summary}\n\nFix the bug in app/index.html so the test passes. Do not change the test.`);
      const html = fs.readFileSync(path.join(dir, 'app', 'index.html'), 'utf8');
      record.steps.push({ step: 'agent fixed app', agentSaid: fixSaid.slice(0, 1500), fixed: !html.includes("'</strong> items left'") });
      log(`[${name}] Claude Code: ${fixSaid.replace(/\s+/g, ' ').slice(0, 200)}`);
      log(`[${name}] Kane replays the same test…`);
      r = await runTest(kane, testFile, { replay: true });
      v = verdictOf(r);
      record.steps.push({ step: 'kane after fix', verdict: v, summary: r.summary, credits: r.credits, testUrl: r.testUrl });
      log(`[${name}] Kane after the fix: ${v}`);
    }
    record.outcome = record.steps.find((s) => s.step === 'kane on buggy app')?.verdict === 'PASS' ? 'bug shipped (false green)' : v === 'PASS' ? 'bug caught and fixed' : 'bug caught, not fixed';
  } catch (e) {
    record.error = String(e.message || e);
    log(`[${name}] error: ${record.error}`);
  } finally {
    server.close();
  }
  fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify(record, null, 2));
  log(`[${name}] outcome: ${record.outcome || record.error}`);
  return record;
}

const which = process.argv[2] || 'both';
const results = [];
for (const v of which === 'both' ? ['without', 'with'] : [which]) results.push(await variant(v));
fs.writeFileSync(path.join(HERE, 'results.json'), JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
