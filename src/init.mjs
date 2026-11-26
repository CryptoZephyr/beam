// npx github:CryptoZephyr/beam init: add the Beam probe to an app's dev build, and show how to declare truth.
import fs from 'node:fs';
import path from 'node:path';

const TAG = '<script src="http://127.0.0.1:4330/beam-probe.js"></script>';
const MARK = 'beam-probe.js';
const LOADER = `// Beam probe: dev only. Reports the app's own truth to Beam on this machine.
if (import.meta.env?.DEV) {
  const s = document.createElement('script');
  s.src = 'http://127.0.0.1:4330/beam-probe.js';
  document.head.appendChild(s);
}
`;

function detect(dir) {
  const pkgFile = path.join(dir, 'package.json');
  const pkg = fs.existsSync(pkgFile) ? JSON.parse(fs.readFileSync(pkgFile, 'utf8')) : {};
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (deps.next) return { kind: 'next' };
  if (deps.vite) {
    for (const f of ['src/main.ts', 'src/main.tsx', 'src/main.js', 'src/main.jsx', 'src/index.ts', 'src/index.tsx', 'src/index.js', 'src/index.jsx']) {
      if (fs.existsSync(path.join(dir, f))) return { kind: 'vite', file: path.join(dir, f) };
    }
    return { kind: 'vite' };
  }
  for (const f of ['index.html', 'public/index.html', 'src/index.html']) {
    if (fs.existsSync(path.join(dir, f))) return { kind: 'html', file: path.join(dir, f) };
  }
  return { kind: 'unknown' };
}

export async function init(args, out) {
  const dir = path.resolve(args._[0] || '.');
  const found = detect(dir);
  const rel = (f) => path.relative(process.cwd(), f) || f;
  let changed = null;

  if (found.kind === 'html') {
    const html = fs.readFileSync(found.file, 'utf8');
    if (html.includes(MARK)) out(`The probe is already in ${rel(found.file)}.`);
    else if (!/<head[^>]*>|<html[^>]*>/i.test(html)) out(`Couldn't find <head> in ${rel(found.file)}. Add this line inside it:\n  ${TAG}`);
    else {
      // No <head>? Browsers accept one right after <html>, so add it there.
      const next = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => `${m}\n${TAG}`) : html.replace(/<html[^>]*>/i, (m) => `${m}\n<head>\n${TAG}\n</head>`);
      fs.writeFileSync(found.file, next);
      changed = found.file;
      out(`Added the probe to ${rel(found.file)}. It does nothing unless the page is on your own machine.`);
    }
  } else if (found.kind === 'vite' && found.file) {
    const src = fs.readFileSync(found.file, 'utf8');
    if (src.includes(MARK)) out(`The probe is already in ${rel(found.file)}.`);
    else {
      fs.writeFileSync(found.file, LOADER + src);
      changed = found.file;
      out(`Added the probe loader to ${rel(found.file)}, behind import.meta.env.DEV.`);
    }
  } else if (found.kind === 'next') {
    out('Next.js: add this to app/layout.tsx inside <head>, so it only loads in development:');
    out(`  {process.env.NODE_ENV === 'development' && <script src="http://127.0.0.1:4330/beam-probe.js" />}`);
  } else {
    out(`No index.html, Vite or Next.js entry found in ${rel(dir)}. Add this to your dev page's <head>:\n  ${TAG}`);
  }

  out('');
  out('Next:');
  out('1. Expose what your app knows to be true, next to the feature:');
  out("     beam.expose('cart.total', () => cart.total)");
  out('2. Next to a Kane test (name_test.md), write name_test.beam.json:');
  out('     { "truth": [ { "key": "cart.total", "equals": 45 }, { "network": "no-failures" } ] }');
  out('3. Run it: npx github:CryptoZephyr/beam verify path/to/name_test.md --record');
  if (changed) out(`\nTo undo: remove the Beam line from ${rel(changed)}.`);
  return 0;
}
