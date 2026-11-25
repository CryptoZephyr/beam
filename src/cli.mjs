#!/usr/bin/env node
// Maintainer commands: suite, kane-install, site, lab, add-issue.
import { loadBehaviors } from './behaviors.mjs';
import { startFixtureServer } from './fixture-server.mjs';
import { installedKanes, installKane } from './versions.mjs';
import { Runner } from './runner.mjs';

const [cmd, ...rest] = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (a.startsWith('--')) {
    const [k, v] = a.slice(2).split('=');
    flags[k] = v ?? (rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : true);
  } else positional.push(a);
}

const t = () => new Date().toTimeString().slice(0, 8);

async function suite() {
  const behaviors = loadBehaviors(positional.length ? positional : null);
  let kanes = installedKanes();
  if (flags.versions) {
    const want = String(flags.versions).split(',');
    kanes = kanes.filter((k) => k.reference || want.includes(k.version));
  }
  const { close } = await startFixtureServer();
  let repair = null;
  if (!flags['no-agent']) {
    const { repairWordings } = await import('./agent.mjs').catch(() => ({}));
    repair = repairWordings || null;
  }
  const runner = new Runner({ kanes, budget: Number(flags.budget || 300), headed: !!flags.headed, force: !!flags.force, repair });
  runner.on('run:start', (e) => console.log(`${t()} Run: ${e.behaviors.length} behaviors on Kane ${e.versions.join(', ')} (budget ${e.budget} credits)`));
  runner.on('behavior:skip', (e) => console.log(`${t()} SKIP ${e.id}: ${e.reason}`));
  runner.on('cell:start', (e) => console.log(`${t()} ${e.id} ${e.wording} ${e.version} ${e.twin} ${e.recording ? 'record' : 'replay'}…`));
  runner.on('cell:done', (e) => console.log(`${t()}   → ${e.verdict}  [${e.state}]  ${e.credits ? e.credits.toFixed(1) + ' cr' : ''}  (spent ${e.spent})`));
  runner.on('agent:start', (e) => console.log(`${t()} ${e.id}: no wording is right, asking the agent for new ones`));
  runner.on('agent:wordings', (e) => console.log(`${t()} ${e.id}: agent proposed ${e.wordings.length}: ${e.wordings.map((w) => JSON.stringify(w)).join(' | ')}`));
  runner.on('agent:error', (e) => console.log(`${t()} ${e.id}: agent unavailable (${e.error})`));
  runner.on('behavior:done', (e) => console.log(`${t()} ${e.id} done: ${JSON.stringify(e.states)}`));
  runner.on('budget:stop', (e) => console.log(`${t()} Stopped: spent ${e.spent} of ${e.budget} credits`));
  runner.on('kane:retry', (e) => console.log(`${t()} Kane had a server error, retrying in 20 s: ${String(e.message).split(/\r?\n/).pop()}`));
  runner.on('kane:not-ready', (e) => console.log(`${t()} Kane isn't ready: ${e.message}`));
  runner.on('run:done', (e) => console.log(`${t()} Done. ${e.credits} credits reported by Kane.`));
  process.on('SIGINT', () => runner.stop());
  await runner.run(behaviors);
  await close();
}

const commands = {
  suite,
  'kane-install': async () => {
    if (!positional[0]) throw new Error('Usage: npm run kane:install -- <version>');
    const k = installKane(positional[0]);
    console.log(`Installed Kane ${k.version} in kane/${k.version}/`);
  },
  site: async () => (await import('./site.mjs')).buildSite(),
  lab: async () => (await import('./lab-server.mjs')).startLab(),
  'add-issue': async () => (await import('./add-issue.mjs')).addIssue(positional[0], flags),
  compat: async () => console.log(JSON.stringify((await import('./compat.mjs')).buildCompat(), null, 2).slice(0, 4000)),
};

if (!commands[cmd]) {
  console.log('Usage: node src/cli.mjs <suite|kane-install|site|lab|add-issue> [args]');
  process.exit(cmd ? 1 : 0);
}
commands[cmd]().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
