// Lab mode: the same site served locally, plus run controls and live updates over SSE.
// Binds to 127.0.0.1 only, because it spends Kane credits and runs an agent.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { ensureBridge, getSnapshots } from './bridge.mjs';
import { verify } from './verify.mjs';
import { buildSite } from './site.mjs';
import { loadBehaviors } from './behaviors.mjs';
import { installedKanes } from './versions.mjs';
import { startFixtureServer } from './fixture-server.mjs';
import { Runner } from './runner.mjs';
import { ROOT } from './paths.mjs';

const PORT = Number(process.env.BEAM_LAB_PORT || 4317);
const LAB_DIR = path.join(ROOT, '.lab-site');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };

// Demo apps the lab can verify: every demo/<app>/tests/*_test.md with a .beam.json beside it.
function demoTests() {
  const out = [];
  const demo = path.join(ROOT, 'demo');
  for (const app of fs.existsSync(demo) ? fs.readdirSync(demo) : []) {
    const tests = path.join(demo, app, 'tests');
    if (!fs.existsSync(tests)) continue;
    for (const f of fs.readdirSync(tests)) {
      if (f.endsWith('_test.md') && fs.existsSync(path.join(tests, f.replace(/.md$/, '.beam.json')))) out.push({ id: `${app}/${f}`, app, file: path.join(tests, f) });
    }
  }
  return out;
}

// Start a demo app's server if it has one and the lab hasn't started it yet.
const demoServers = new Map();
function ensureDemoServer(app) {
  const server = path.join(ROOT, 'demo', app, 'server.mjs');
  if (!fs.existsSync(server) || demoServers.has(app)) return;
  const child = spawn(process.execPath, [server], { stdio: 'ignore', windowsHide: true });
  child.on('exit', () => demoServers.delete(app));
  demoServers.set(app, child);
}

export async function startLab() {
  const fixtures = await startFixtureServer();
  const bridge = await ensureBridge();
  const clients = new Set();
  let active = null; // { runner, cells: {} }
  const drafts = new Map();

  const send = (type, data) => {
    const msg = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const c of clients) c.write(msg);
  };
  const rebuild = () => buildSite({ lab: true, outDir: LAB_DIR });
  rebuild();

  const json = (res, code, obj) => res.writeHead(code, { 'content-type': 'application/json' }).end(JSON.stringify(obj));
  const body = (req) => new Promise((r) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch { r({}); } }); });

  const allowedHosts = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`]);
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    // Only the lab page itself may use the API: blocks other sites (and DNS rebinding) from
    // spending credits or touching files through this local server.
    if (!allowedHosts.has(req.headers.host || '')) return res.writeHead(403).end('forbidden host');
    if (url.pathname.startsWith('/api/') && req.method === 'POST') {
      const origin = req.headers.origin;
      if (origin && !allowedHosts.has(origin.replace(/^https?:\/\//, ''))) return res.writeHead(403).end('forbidden origin');
      if (!String(req.headers['content-type'] || '').startsWith('application/json')) return res.writeHead(415).end('send application/json');
    }
    try {
      if (url.pathname === '/api/state') {
        return json(res, 200, { behaviors: loadBehaviors().map((b) => ({ id: b.id, title: b.title })), versions: installedKanes().map((k) => k.version), active: active ? { cells: active.cells, spent: active.runner.spent } : null });
      }
      if (url.pathname === '/api/events') {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
        res.write(`event: hello\ndata: ${JSON.stringify({ active: !!active, cells: active?.cells || {} })}\n\n`);
        clients.add(res);
        req.on('close', () => clients.delete(res));
        return;
      }
      if (url.pathname === '/api/tests') return json(res, 200, demoTests().map(({ id, app }) => ({ id, app })));
      if (url.pathname === '/api/verify' && req.method === 'POST') {
        if (active) return json(res, 409, { error: 'A run is in progress. Wait for it to finish.' });
        const { id, headed = false } = await body(req);
        const t = demoTests().find((x) => x.id === id);
        if (!t) return json(res, 404, { error: 'No such demo test' });
        ensureDemoServer(t.app);
        active = { verify: true, cells: {}, runner: { spent: 0 } };
        send('verify:start', { id });
        send('verify:step', { remark: 'Starting Kane and opening the app (this takes about half a minute)' });
        let last = '';
        const poll = setInterval(async () => {
          try {
            const s = await getSnapshots();
            const snap = s[s.length - 1];
            if (!snap) return;
            const page = s.filter((x) => x.page === snap.page);
            const failed = page.flatMap((x) => x.network || []).filter((r) => !r.ok).map((r) => `${r.method} ${new URL(r.url).pathname} → ${r.status}`);
            const payload = JSON.stringify({ values: snap.values, failed: [...new Set(failed)] });
            if (payload !== last) { last = payload; send('verify:app', JSON.parse(payload)); }
          } catch {}
        }, 600);
        setTimeout(() => verify(t.file, { headed, onStep: (remark) => send('verify:step', { remark }) })
          .then((r) => send('verify:done', r), (e) => send('verify:done', { state: 'COULDNT_RUN', label: "Couldn't run", note: String(e.message || e) }))
          .finally(() => { clearInterval(poll); active = null; }), 800);
        return json(res, 202, { started: true });
      }
      if (url.pathname === '/api/run' && req.method === 'POST') {
        if (active) return json(res, 409, { error: 'A run is in progress. Wait for it to finish.' });
        const { ids, versions, budget = 100, headed = false } = await body(req);
        const behaviors = loadBehaviors(ids && ids.length ? ids : null);
        const kanes = installedKanes().filter((k) => k.reference || !versions || versions.includes(k.version));
        const { repairWordings } = await import('./agent.mjs');
        const runner = new Runner({ kanes, budget: Number(budget), headed: !!headed, repair: repairWordings });
        active = { runner, cells: {} };
        for (const ev of ['run:start', 'behavior:start', 'behavior:skip', 'cell:start', 'kane:step', 'cell:done', 'agent:start', 'agent:wordings', 'agent:error', 'behavior:done', 'budget:stop', 'kane:not-ready']) {
          runner.on(ev, (d) => {
            if (ev === 'cell:start' || ev === 'kane:step') active.cells[`${d.id}|${d.version}`] = { running: true, twin: d.twin, wording: d.wording, remark: d.remark || '' };
            if (ev === 'cell:done') active.cells[`${d.id}|${d.version}`] = { running: false };
            send(ev, d);
          });
        }
        runner.run(behaviors).then((r) => {
          active = null;
          rebuild();
          send('run:done', { credits: runner.spent });
        }, (e) => { active = null; send('error', { message: String(e.message || e) }); });
        return json(res, 202, { started: true, behaviors: behaviors.map((b) => b.id), versions: kanes.map((k) => k.version) });
      }
      if (url.pathname === '/api/draft' && req.method === 'POST') {
        const { issueUrl } = await body(req);
        const { draftFromIssue } = await import('./add-issue.mjs');
        send('draft:start', { issueUrl });
        const d = await draftFromIssue(issueUrl);
        drafts.set(d.id, d);
        return json(res, 200, d);
      }
      if (url.pathname === '/api/approve' && req.method === 'POST') {
        const { id } = await body(req);
        if (!drafts.has(id)) return json(res, 404, { error: 'No such draft' });
        const { approveDraft } = await import('./add-issue.mjs');
        approveDraft(id);
        drafts.delete(id);
        rebuild();
        return json(res, 200, { approved: id });
      }
      if (url.pathname === '/api/discard' && req.method === 'POST') {
        const { id } = await body(req);
        if (!drafts.has(id)) return json(res, 404, { error: 'No such draft' });
        const { discardDraft } = await import('./add-issue.mjs');
        discardDraft(id);
        drafts.delete(id);
        return json(res, 200, { discarded: id });
      }
      if (url.pathname.startsWith('/drafts/')) {
        const f = path.join(ROOT, 'fixtures', '_drafts', url.pathname.slice('/drafts/'.length));
        if (!f.startsWith(path.join(ROOT, 'fixtures', '_drafts')) || !fs.existsSync(f)) return res.writeHead(404).end();
        return res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'text/plain' }).end(fs.readFileSync(f));
      }
      // Static lab site.
      let p = decodeURIComponent(url.pathname);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(LAB_DIR, p);
      if (!f.startsWith(LAB_DIR) || !fs.existsSync(f)) return res.writeHead(404).end('not found');
      res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(fs.readFileSync(f));
    } catch (e) {
      json(res, 500, { error: String(e.message || e) });
    }
  });
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
  const url = `http://localhost:${PORT}/`;
  console.log(`Beam lab running at ${url} (Ctrl+C to stop)`);
  if (!process.env.BEAM_NO_OPEN) {
    const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : [process.platform === 'darwin' ? 'open' : 'xdg-open', [url]];
    execFile(cmd, args, () => {});
  }
  process.on('SIGINT', async () => { for (const c of demoServers.values()) c.kill(); await fixtures.close(); await bridge.close(); server.close(); process.exit(0); });
  return { server, fixtures };
}
