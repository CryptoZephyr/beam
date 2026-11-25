// Kane CLI versions: the global install is the reference; others live side by side in kane/<version>/.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { KANE_DIR } from './paths.mjs';

const PKG = ['@testmuai', 'kane-cli'];

function entryFrom(modulesDir) {
  const pkgDir = path.join(modulesDir, ...PKG);
  const pj = path.join(pkgDir, 'package.json');
  if (!fs.existsSync(pj)) return null;
  const p = JSON.parse(fs.readFileSync(pj, 'utf8'));
  const bin = typeof p.bin === 'string' ? p.bin : Object.values(p.bin)[0];
  return { version: p.version, entry: path.join(pkgDir, bin) };
}

let globalRoot;
function npmRootGlobal() {
  if (globalRoot === undefined) {
    try {
      globalRoot = execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['root', '-g'], { encoding: 'utf8', shell: process.platform === 'win32' }).trim();
    } catch {
      globalRoot = null;
    }
  }
  return globalRoot;
}

export function referenceKane() {
  const root = process.env.BEAM_KANE_GLOBAL_ROOT || npmRootGlobal();
  const found = root && entryFrom(root);
  if (!found) throw new Error('Kane CLI is not installed globally. Run: npm install -g @testmuai/kane-cli');
  return { ...found, reference: true };
}

export function installedKanes() {
  const ref = referenceKane();
  const list = [ref];
  if (fs.existsSync(KANE_DIR)) {
    for (const v of fs.readdirSync(KANE_DIR).sort().reverse()) {
      const found = entryFrom(path.join(KANE_DIR, v, 'node_modules'));
      if (found && found.version !== ref.version) list.push({ ...found, reference: false });
    }
  }
  return list;
}

export function installKane(version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Not a version: ${version}`);
  const dir = path.join(KANE_DIR, version);
  fs.mkdirSync(dir, { recursive: true });
  const r = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--no-audit', '--no-fund', '--prefix', dir, `@testmuai/kane-cli@${version}`], { stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) throw new Error(`npm install failed for ${version}`);
  return entryFrom(path.join(dir, 'node_modules'));
}
