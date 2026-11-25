// Serves fixture twins on 127.0.0.1. GET /f/<id>/ returns the currently selected twin
// (correct or broken) for that behavior, so a Kane test always uses the same URL.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { FIXTURES_DIR } from './paths.mjs';

export const FIXTURE_PORT = Number(process.env.BEAM_FIXTURE_PORT || 4318);
export const fixtureUrl = (id) => `http://127.0.0.1:${FIXTURE_PORT}/f/${id}/`;

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

export function startFixtureServer({ port = FIXTURE_PORT, dir = FIXTURES_DIR } = {}) {
  const twins = new Map(); // id -> 'correct' | 'broken'
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/__twin' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const { id, twin } = JSON.parse(body);
          if (!['correct', 'broken'].includes(twin)) throw new Error('twin must be correct or broken');
          twins.set(id, twin);
          res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ id, twin }));
        } catch (e) {
          res.writeHead(400).end(String(e.message));
        }
      });
      return;
    }
    const m = url.pathname.match(/^\/f\/([a-z0-9-]+)\/(.*)$/);
    if (!m) return res.writeHead(404).end('not found');
    const [, id, rest] = m;
    const file = rest === '' || rest === 'index.html' ? `${twins.get(id) || 'correct'}.html` : rest;
    const full = path.join(dir, id, file);
    if (!full.startsWith(path.join(dir, id))) return res.writeHead(403).end();
    fs.readFile(full, (err, buf) => {
      if (err) return res.writeHead(404).end('not found');
      res.writeHead(200, { 'content-type': TYPES[path.extname(full)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(buf);
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve({ server, twins, close: () => new Promise((r) => server.close(r)) }));
  });
}

export async function setTwin(id, twin, port = FIXTURE_PORT) {
  const r = await fetch(`http://127.0.0.1:${port}/__twin`, { method: 'POST', body: JSON.stringify({ id, twin }) });
  if (!r.ok) throw new Error(`could not switch ${id} to ${twin}: ${r.status}`);
}

// Fetch both twins through the server and confirm they're served and different.
// This exists because a wrong server root once cost 25 credits of Kane runs on 404 pages.
export async function precheck(id, port = FIXTURE_PORT) {
  const hashes = {};
  for (const twin of ['correct', 'broken']) {
    await setTwin(id, twin, port);
    const r = await fetch(`http://127.0.0.1:${port}/f/${id}/`);
    const text = await r.text();
    if (r.status !== 200) return { ok: false, reason: `${twin} page returned HTTP ${r.status}` };
    hashes[twin] = crypto.createHash('sha256').update(text).digest('hex');
  }
  if (hashes.correct === hashes.broken) return { ok: false, reason: 'correct and broken pages are identical' };
  return { ok: true, hashes };
}
