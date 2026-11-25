// The Beam bridge: a small server on 127.0.0.1 that serves the probe and collects what the app reports.
//
// Who may talk to it:
// - the Host header must be 127.0.0.1 or localhost (blocks DNS rebinding);
// - browser requests must come from a loopback origin, never "null" or another site;
// - data endpoints (/snapshot, /snapshots, /reset) need the session token. The probe gets it
//   baked into the script the bridge serves; Beam's own tools read it from a file only this
//   user can read.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const BRIDGE_PORT = Number(process.env.BEAM_BRIDGE_PORT || 4330);
export const BRIDGE_URL = `http://127.0.0.1:${BRIDGE_PORT}`;
const PROBE_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'probe', 'beam-probe.js');
// Per-user folder, owner-only: never the shared temp folder.
const TOKEN_DIR = path.join(process.env.BEAM_HOME || os.homedir(), '.kane-beam');
const TOKEN_FILE = path.join(TOKEN_DIR, `bridge-${BRIDGE_PORT}.json`);

function writeTokenFile(data) {
  fs.mkdirSync(TOKEN_DIR, { recursive: true, mode: 0o700 });
  try {
    const st = fs.lstatSync(TOKEN_FILE);
    if (!st.isFile()) throw new Error(`${TOKEN_FILE} is not a regular file; refusing to use it`);
    fs.rmSync(TOKEN_FILE);
  } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW || 0);
  const fd = fs.openSync(TOKEN_FILE, flags, 0o600);
  try { fs.writeSync(fd, JSON.stringify(data)); } finally { fs.closeSync(fd); }
}
const LOOPBACK_ORIGIN = /^https?:\/\/(localhost|127\.\d+\.\d+\.\d+|\[::1\]|[a-z0-9-]+(\.[a-z0-9-]+)*\.localhost)(:\d+)?$/i;
const LOOPBACK_HOST = /^(127\.0\.0\.1|localhost)(:\d+)?$/i;
const MAX_SNAPSHOTS = 2000;

export function isLoopbackOrigin(origin) {
  return origin === undefined || (typeof origin === 'string' && LOOPBACK_ORIGIN.test(origin));
}

export function startBridge({ port = BRIDGE_PORT } = {}) {
  const snaps = [];
  const token = crypto.randomBytes(18).toString('hex');
  const server = http.createServer((req, res) => {
    if (!LOOPBACK_HOST.test(req.headers.host || '')) return res.writeHead(403).end('Beam only answers on 127.0.0.1');
    const origin = req.headers.origin;
    if (!isLoopbackOrigin(origin)) return res.writeHead(403).end('Beam only accepts pages on this machine');
    const cors = origin ? { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'content-type, x-beam-token', vary: 'origin' } : {};
    if (req.method === 'OPTIONS') return res.writeHead(204, cors).end();
    const url = new URL(req.url, 'http://x');
    const authed = () => req.headers['x-beam-token'] === token || url.searchParams.get('t') === token;

    if (url.pathname === '/beam-probe.js' || url.pathname === '/probe.js') {
      const src = fs.readFileSync(PROBE_FILE, 'utf8').replace('__BEAM_TOKEN__', token);
      return res.writeHead(200, { ...cors, 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' }).end(src);
    }
    if (url.pathname === '/health') return res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: true, beam: true }));
    if (!authed()) return res.writeHead(401, cors).end('missing Beam token');

    if (url.pathname === '/snapshot' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 1_000_000) req.destroy(); });
      req.on('end', () => {
        try {
          const s = JSON.parse(body);
          s.received = Date.now();
          snaps.push(s);
          if (snaps.length > MAX_SNAPSHOTS) snaps.shift();
        } catch {}
        res.writeHead(204, cors).end();
      });
      return;
    }
    if (url.pathname === '/snapshots') return res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(snaps));
    if (url.pathname === '/reset' && req.method === 'POST') { snaps.length = 0; return res.writeHead(204).end(); }
    res.writeHead(404).end('not found');
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      writeTokenFile({ port, token, pid: process.pid });
      resolve({
        server, snaps, token,
        close: () => new Promise((r) => server.close(() => { try { const t = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')); if (t.token === token) fs.rmSync(TOKEN_FILE); } catch {} r(); })),
      });
    });
  });
}

function readToken() {
  try {
    const st = fs.lstatSync(TOKEN_FILE);
    if (!st.isFile()) return null;
    if (typeof process.getuid === 'function' && (st.uid !== process.getuid() || (st.mode & 0o077))) return null;
    return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')).token;
  } catch { return null; }
}

// Use a running Beam bridge if there is one, otherwise start one in this process.
export async function ensureBridge() {
  try {
    const r = await fetch(`${BRIDGE_URL}/health`, { signal: AbortSignal.timeout(1500) });
    if (r.ok && (await r.json()).beam && readToken()) return { external: true, close: async () => {} };
  } catch {}
  const b = await startBridge();
  return { external: false, close: b.close };
}

export async function getSnapshots() {
  const r = await fetch(`${BRIDGE_URL}/snapshots`, { headers: { 'x-beam-token': readToken() || '' } });
  if (!r.ok) throw new Error(`Beam bridge not reachable at ${BRIDGE_URL} (${r.status})`);
  return r.json();
}

export async function resetSnapshots() {
  await fetch(`${BRIDGE_URL}/reset`, { method: 'POST', headers: { 'x-beam-token': readToken() || '' } });
}
