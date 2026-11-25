// Reads Kane's sealed evidence pack (.evidence, a zip) without dependencies, and pulls out what
// Kane itself recorded: its network log and console. Kane's policies can't gate on these yet
// (Kane issue #243), so Beam does.
import fs from 'node:fs';
import zlib from 'node:zlib';

export function readZip(file) {
  const buf = fs.readFileSync(file);
  // End of central directory: scan back for its signature.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a zip file');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Bad zip central directory');
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    entries.set(name, { method, compSize, local });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return {
    names: () => [...entries.keys()],
    read(name) {
      const e = entries.get(name);
      if (!e) return null;
      const lnameLen = buf.readUInt16LE(e.local + 26);
      const lextraLen = buf.readUInt16LE(e.local + 28);
      const start = e.local + 30 + lnameLen + lextraLen;
      const data = buf.subarray(start, start + e.compSize);
      if (e.method === 0) return data;
      if (e.method === 8) return zlib.inflateRawSync(data);
      throw new Error(`Unsupported zip method ${e.method} for ${name}`);
    },
  };
}

const STATIC = /\.(css|js|mjs|map|woff2?|ttf|png|jpe?g|gif|svg|ico|webp)(\?|$)/i;

// What Kane's own recording says about the app: failed requests and console errors.
export function packTruth(packFile, { ignoreHosts = [] } = {}) {
  const zip = readZip(packFile);
  const failedRequests = [];
  const requests = [];
  const consoleErrors = [];
  for (const name of zip.names()) {
    if (name.endsWith('/logs/0-network.har') || /\/logs\/\d+-network\.har$/.test(name)) {
      let har;
      try { har = JSON.parse(zip.read(name).toString('utf8')); } catch { continue; }
      for (const e of har.log?.entries || []) {
        const url = e.request?.url || '';
        let u;
        try { u = new URL(url); } catch { continue; }
        if (STATIC.test(u.pathname) || ignoreHosts.includes(u.host)) continue;
        const status = e.response?.status ?? 0;
        const row = { method: e.request.method, url: `${u.origin}${u.pathname}`, status, body: e.request.postData?.text?.slice(0, 500) };
        requests.push(row);
        if (status === 0 || status >= 400) failedRequests.push(row);
      }
    }
    if (/\/logs\/\d+-console\.ndjson$/.test(name)) {
      for (const line of zip.read(name).toString('utf8').split(/\r?\n/)) {
        if (!line.trim()) continue;
        try {
          const o = JSON.parse(line);
          const level = String(o.type || o.level || '').toLowerCase();
          if (level === 'error') consoleErrors.push(String(o.text || o.message || '').slice(0, 300));
        } catch {}
      }
    }
  }
  return { requests, failedRequests, consoleErrors };
}

// Kane prints the pack path on stderr: "evidence: view locally with `kane-cli evidence serve <path>`".
export function packPathFrom(text) {
  const m = String(text || '').match(/kane-cli evidence serve ([^`\r\n]+\.evidence)/);
  return m ? m[1].trim() : null;
}
