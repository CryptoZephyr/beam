// Beam MCP server: connects your running app to your coding agent.
// stdio JSON-RPC 2.0, no dependencies. Start with: npx github:CryptoZephyr/beam mcp
import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureBridge, getSnapshots } from './bridge.mjs';
import { verify } from './verify.mjs';
import { checkObjective } from './match.mjs';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TOOLS = [
  {
    name: 'beam_app_state',
    description: 'Read what your running app reports about itself right now through the Beam probe: values it exposes with beam.expose (e.g. cart.total, counter.text), localStorage, its own recent requests with status codes, and JS errors. This is the truth behind what the screen shows.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'beam_app_history',
    description: 'How one exposed value changed during the latest page load, oldest first.',
    inputSchema: { type: 'object', properties: { key: { type: 'string', description: 'An exposed value, e.g. cart.total' } }, required: ['key'], additionalProperties: false },
  },
  {
    name: 'beam_verify',
    description: 'Run a Kane CLI test (*_test.md) against the app and weigh Kane\'s verdict against the app\'s own truth from <name>_test.beam.json. Returns Balanced, False green (Kane passed but the app says broken) or False red, with each value that disagrees. Replays recorded tests at no Kane credit cost. Refuses if the test, its recording or its truth file changed since the last verify: fix the app, not the test.',
    inputSchema: {
      type: 'object',
      properties: {
        test_file: { type: 'string', description: 'Path to the *_test.md file' },
        record: { type: 'boolean', description: 'Allow Kane to record (author) the test if it has no recording yet. Costs Kane credits. Default false.' },
      },
      required: ['test_file'],
      additionalProperties: false,
    },
  },
  {
    name: 'beam_check_wording',
    description: 'Before writing a Kane check, look up its wording in Beam\'s measured results: whether this wording is known to pass broken pages, and the wording measured to be right.',
    inputSchema: { type: 'object', properties: { objective: { type: 'string' } }, required: ['objective'], additionalProperties: false },
  },
];

async function call(name, args) {
  if (name === 'beam_app_state') {
    const s = await getSnapshots();
    const last = s[s.length - 1];
    if (!last) return 'The app has not reported anything yet. Open it in a browser with the Beam probe on the page (npx github:CryptoZephyr/beam init adds it).';
    return JSON.stringify({ url: last.url, at: new Date(last.at).toISOString(), values: last.values, storage: last.storage, requests: last.network, errors: last.errors }, null, 2);
  }
  if (name === 'beam_app_history') {
    const s = await getSnapshots();
    const page = s[s.length - 1]?.page;
    const out = [];
    for (const x of s.filter((x) => x.page === page)) {
      const v = x.values?.[args.key];
      if (!out.length || JSON.stringify(out[out.length - 1].value) !== JSON.stringify(v)) out.push({ at: new Date(x.at).toISOString(), value: v });
    }
    return out.length ? JSON.stringify(out, null, 2) : `The app never reported "${args.key}". Add beam.expose('${args.key}', () => ...) in the app.`;
  }
  if (name === 'beam_verify') {
    const r = await verify(args.test_file, { replayOnly: !args.record });
    return JSON.stringify(r, null, 2);
  }
  if (name === 'beam_check_wording') {
    const data = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'beam.json'), 'utf8'));
    const m = checkObjective(args.objective, data);
    if (m.kind === 'known-wrong') return JSON.stringify({ result: 'known false green', behavior: m.behavior.title, use_instead: m.behavior.recommendedWording, proof: `https://kane-beam.vercel.app/b/${m.behavior.id}.html` }, null, 2);
    if (m.kind === 'related') return JSON.stringify({ result: 'related behavior measured', behavior: m.behavior.title, measured_right: m.behavior.recommendedWording }, null, 2);
    return 'No known issue with this wording. Still declare the truth in a .beam.json file and run beam_verify.';
  }
  throw new Error(`Unknown tool ${name}`);
}

export async function startMcp() {
  const bridge = await ensureBridge(); // the probe needs it while the agent works
  const send = (m) => process.stdout.write(JSON.stringify(m) + '\n');
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', async (line) => {
    let req;
    try { req = JSON.parse(line); } catch { return; }
    const { id, method, params } = req;
    if (id === undefined) return;
    if (method === 'initialize') return send({ jsonrpc: '2.0', id, result: { protocolVersion: params?.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'beam', version: JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8')).version } } });
    if (method === 'tools/list') return send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    if (method === 'ping') return send({ jsonrpc: '2.0', id, result: {} });
    if (method === 'tools/call') {
      try {
        return send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: await call(params.name, params.arguments || {}) }] } });
      } catch (e) {
        return send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: String(e.message || e) }], isError: true } });
      }
    }
    send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
  });
  rl.on('close', () => bridge.close().then(() => process.exit(0)));
}
