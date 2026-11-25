// install | update | check | uninstall | where, for the published `kane-beam` command.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { checkObjective } from './match.mjs';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = process.env.BEAM_SITE_URL || 'https://kane-beam.vercel.app';
const home = () => process.env.BEAM_HOME || os.homedir();
const stateFile = () => path.join(home(), '.kane-beam', 'installed.json');
const version = () => JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8')).version;

function readData(file = path.join(PKG_ROOT, 'beam.json')) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
const dataDate = (d) => (d.lastRun ? new Date(d.lastRun).toISOString().slice(0, 10) : 'unknown date');

function detectAgents(cwd) {
  const h = home();
  const found = [];
  if (fs.existsSync(path.join(h, '.claude'))) found.push({ name: 'Claude Code', dir: path.join(h, '.claude', 'skills', 'kane-beam'), kind: 'skill' });
  if (fs.existsSync(path.join(h, '.codex'))) found.push({ name: 'Codex', dir: path.join(h, '.codex', 'skills', 'kane-beam'), kind: 'skill' });
  if (fs.existsSync(path.join(cwd, '.cursor'))) found.push({ name: 'Cursor (this project)', dir: path.join(cwd, '.cursor', 'rules'), kind: 'cursor' });
  return found;
}

function loadState() {
  try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch { return { files: [] }; }
}
function saveState(s) {
  fs.mkdirSync(path.dirname(stateFile()), { recursive: true });
  fs.writeFileSync(stateFile(), JSON.stringify(s, null, 2));
}

function writeFor(agent, skill, dataText) {
  fs.mkdirSync(agent.dir, { recursive: true });
  if (agent.kind === 'cursor') {
    const f = path.join(agent.dir, 'kane-beam.mdc');
    const body = skill.replace(/^---[\s\S]*?---\n/, '');
    fs.writeFileSync(f, `---\ndescription: Kane CLI check wordings measured by Beam\nalwaysApply: false\n---\n${body.replace('`beam.json` in this folder', '`.cursor/rules/beam.json`')}`);
    const d = path.join(agent.dir, 'beam.json');
    fs.writeFileSync(d, dataText);
    return [f, d];
  }
  const f = path.join(agent.dir, 'SKILL.md');
  const d = path.join(agent.dir, 'beam.json');
  fs.writeFileSync(f, skill);
  fs.writeFileSync(d, dataText);
  return [f, d];
}

async function install(args, out) {
  const data = readData();
  const cwd = process.cwd();
  let agents = detectAgents(cwd);
  if (args.dir) agents = [{ name: `folder ${args.dir}`, dir: path.resolve(args.dir, 'kane-beam'), kind: 'skill' }];
  out(`Beam ${version()} · data from ${dataDate(data)} (${data.behaviors.length} behaviors, Kane ${data.versions.join(', ')})\n`);
  if (!agents.length) {
    out('No supported agent found (Claude Code, Codex or Cursor).');
    out('Install into a folder instead: npx kane-beam install --dir .');
    return 1;
  }
  out(`Found: ${agents.map((a) => a.name).join(', ')}`);
  out('Will write:');
  for (const a of agents) out(`  ${a.kind === 'cursor' ? path.join(a.dir, 'kane-beam.mdc') : path.join(a.dir, 'SKILL.md')}, beam.json`);
  if (process.stdin.isTTY && !args.yes) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ans = (await rl.question('Continue? (Y/n) ')).trim().toLowerCase();
    rl.close();
    if (ans === 'n' || ans === 'no') { out('Nothing changed.'); return 0; }
  }
  const skill = fs.readFileSync(path.join(PKG_ROOT, 'skill', 'SKILL.md'), 'utf8');
  const dataText = JSON.stringify(data, null, 2);
  const state = loadState();
  for (const a of agents) for (const f of writeFor(a, skill, dataText)) if (!state.files.includes(f)) state.files.push(f);
  state.version = version();
  state.dataDate = dataDate(data);
  saveState(state);
  out(`\nInstalled for ${agents.map((a) => a.name).join(' and ')}.`);
  out('Next: ask your agent for a Kane check, or try');
  out(`  npx kane-beam check "Verify the todo counter reads '1 item left'"`);
  out('Undo anytime: npx kane-beam uninstall');
  return 0;
}

async function update(args, out) {
  const state = loadState();
  const dataFiles = state.files.filter((f) => f.endsWith('beam.json'));
  if (!dataFiles.length) { out('Beam isn\'t installed yet. Run: npx kane-beam install'); return 1; }
  let text;
  try {
    const r = await fetch(`${SITE}/beam.json`, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    text = await r.text();
    const d = JSON.parse(text);
    if (d.schema !== 1 || !Array.isArray(d.behaviors)) throw new Error('unexpected data format');
  } catch (e) {
    out(`Couldn't reach ${SITE} (${e.message}). Keeping your data from ${state.dataDate || 'install'}.`);
    return 1;
  }
  const d = JSON.parse(text);
  for (const f of dataFiles) {
    if (fs.existsSync(f)) fs.copyFileSync(f, f + '.bak');
    fs.writeFileSync(f, JSON.stringify(d, null, 2));
  }
  state.dataDate = dataDate(d);
  saveState(state);
  out(`Updated ${dataFiles.length} file(s) to data from ${dataDate(d)} (${d.behaviors.length} behaviors).`);
  return 0;
}

function check(args, out) {
  const objective = args._.join(' ').trim();
  if (!objective) { out('Usage: npx kane-beam check "<Kane objective>"'); return 2; }
  const data = readData();
  const m = checkObjective(objective, data);
  if (m.kind === 'known-wrong') {
    const label = m.wording.state === 'FALSE_GREEN' ? 'Known false green' : 'Known false red';
    out(`${label}: ${m.behavior.title} (Kane ${data.versions.join(', ')})`);
    out(m.wording.state === 'FALSE_GREEN' ? 'This wording passed a page where the check should fail.' : 'This wording failed a page where the check should pass.');
    if (m.behavior.recommendedWording) { out('Use instead:'); out(`  ${m.behavior.recommendedWording}`); }
    else out('No wording tried so far is right. Add a second check that doesn\'t depend on Kane.');
    out(`Proof: ${SITE}/b/${m.behavior.id}.html`);
    return 1;
  }
  if (m.kind === 'related') {
    out(`Related: ${m.behavior.title} (${m.behavior.state.toLowerCase().replace(/_/g, ' ')})`);
    if (m.behavior.recommendedWording) out(`Measured to be right:\n  ${m.behavior.recommendedWording}`);
    out(`Details: ${SITE}/b/${m.behavior.id}.html`);
    return 0;
  }
  out(`No known issue for this wording. Beam covers ${data.behaviors.length} behaviors: ${SITE}`);
  return 0;
}

function uninstall(args, out) {
  const state = loadState();
  if (!state.files.length) { out('Nothing to remove.'); return 0; }
  for (const f of state.files) {
    for (const x of [f, f + '.bak']) if (fs.existsSync(x)) fs.rmSync(x);
    const dir = path.dirname(f);
    if (fs.existsSync(dir) && path.basename(dir) === 'kane-beam' && !fs.readdirSync(dir).length) fs.rmdirSync(dir);
  }
  out(`Removed ${state.files.length} file(s).`);
  fs.rmSync(path.dirname(stateFile()), { recursive: true, force: true });
  return 0;
}

function where(args, out) {
  const state = loadState();
  if (!state.files.length) { out('Not installed.'); return 0; }
  out(`Beam ${state.version}, data from ${state.dataDate}`);
  for (const f of state.files) out(`  ${f}`);
  return 0;
}

export async function main(argv, out = console.log) {
  const [cmd, ...rest] = argv;
  const args = { _: [] };
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--yes' || rest[i] === '-y') args.yes = true;
    else if (rest[i] === '--dir') args.dir = rest[++i];
    else args._.push(rest[i]);
  }
  const cmds = { install, update, check, uninstall, where };
  if (!cmds[cmd]) {
    out('Beam: make every Kane green a true green.\n\nUsage:\n  npx kane-beam install      add the skill to Claude Code, Codex or Cursor\n  npx kane-beam check "..."  check a Kane objective against measured results\n  npx kane-beam update       get the latest results\n  npx kane-beam uninstall    remove everything install added\n  npx kane-beam where        show what is installed');
    return cmd ? 2 : 0;
  }
  return cmds[cmd](args, out);
}
