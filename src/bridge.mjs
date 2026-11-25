// The Beam bridge: a small server on 127.0.0.1 that serves the probe and collects what the app reports.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BRIDGE_PORT = Number(process.env.BEAM_BRIDGE_PORT || 4330);
export const BRIDGE_URL = `http://127.0.0.1:${BRIDGE_PORT}`;
const PROBE_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'probe', 'beam-probe.js');
const LOOPBACK_ORIGIN = /^https?:\/\/(localhost|127\.\d+\.\d+\.\d+|\[::1\]|[a-z0-9.-]+\.localhost)(:\d+)?$/i;
const MAX_SNAPSHOTS = 2000;

export function isLoopbackOrigin(origin) {
  return !origin || origin === 'null' || LOOPBACK_ORIGIN.test(origin);
}

export function startBridge({ port = BRIDGE_PORT } = {}) {
  const snaps = [];
  const server = http.createServer((req, res) => {
    const origin = req.headers.origin;
    if (!isLoopbackOrigin(origin)) return res.writeHead(403).end('Beam only accepts pages on this machine');
    const cors = origin ? { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'content-type', vary: 'origin' } : {};
    if (req.method === 'OPTIONS') return res.writeHead(204, cors).end();
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/beam-probe.js' || url.pathname === '/probe.js') {
      return res.writeHead(200, { ...cors, 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' }).end(fs.readFileSync(PROBE_FILE));
    }
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
    if (url.pathname === '/snapshots') return res.writeHead(200, { ...cors, 'content-type': 'application/json' }).end(JSON.stringify(snaps));
    if (url.pathname === '/reset' && req.method === 'POST') { snaps.length = 0; return res.writeHead(204, cors).end(); }
    if (url.pathname === '/health') return res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: true, snapshots: snaps.length }));
    res.writeHead(404).end('not found');
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve({ server, snaps, close: () => new Promise((r) => server.close(r)) }));
  });
}

// Use a running bridge if there is one, otherwise start one in this process.
export async function ensureBridge() {
  try {
    const r = await fetch(`${BRIDGE_URL}/health`, { signal: AbortSignal.timeout(1500) });
    if (r.ok) return { external: true, close: async () => {} };
  } catch {}
  const b = await startBridge();
  return { external: false, close: b.close };
}

export async function getSnapshots() {
  const r = await fetch(`${BRIDGE_URL}/snapshots`);
  if (!r.ok) throw new Error(`Beam bridge not reachable at ${BRIDGE_URL}`);
  return r.json();
}

export async function resetSnapshots() {
  await fetch(`${BRIDGE_URL}/reset`, { method: 'POST' });
}
