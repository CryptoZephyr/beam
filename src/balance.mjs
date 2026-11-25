// Weighs Kane's verdict against the app's own truth (what the probe reported during the run).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const BALANCE_LABEL = {
  BALANCED: 'Balanced',
  FALSE_GREEN: 'False green',
  FALSE_RED: 'False red',
  COULDNT_RUN: "Couldn't run",
  NO_PROBE: 'No probe',
};

// `<name>_test.md` → `<name>_test.beam.json`
export const truthFileFor = (testFile) => testFile.replace(/\.md$/, '.beam.json');

export function readTruth(testFile) {
  const f = truthFileFor(testFile);
  if (!fs.existsSync(f)) throw new Error(`No truth file. Create ${path.basename(f)} next to the test, e.g. {"truth":[{"key":"counter.text","equals":"1 item left"}]}`);
  const t = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (!Array.isArray(t.truth) || !t.truth.length) throw new Error(`${path.basename(f)} needs a non-empty "truth" list`);
  return t.truth;
}

function lastPageSnapshots(snapshots) {
  if (!snapshots.length) return [];
  const page = snapshots[snapshots.length - 1].page ?? snapshots[snapshots.length - 1].session;
  return snapshots.filter((s) => (s.page ?? s.session) === page);
}

function valueFor(last, key) {
  if (last.values && key in last.values) return { found: true, value: last.values[key] };
  if (last.storage && key in last.storage) return { found: true, value: last.storage[key] };
  return { found: false, value: undefined };
}

// truth items: {key, equals} | {key, min} | {key, present:true} | {network:"no-failures"} | {errors:"none"}
export function weigh(verdict, snapshots, truth, { packFailedRequests = [] } = {}) {
  const all = snapshots || [];
  if (!all.length) return { state: 'NO_PROBE', kane: verdict, note: 'The app reported nothing during the run. Is the Beam probe on the page, and is the bridge running?' };
  const page = lastPageSnapshots(all);
  const last = page[page.length - 1];
  const requests = page.flatMap((s) => s.network || []);
  const seen = new Set();
  const uniqueRequests = requests.filter((r) => { const k = `${r.method} ${r.url} ${r.at}`; if (seen.has(k)) return false; seen.add(k); return true; });
  const failedRequests = uniqueRequests.filter((r) => !r.ok);
  // Kane's own network log is a second witness: add what it saw that the probe didn't.
  for (const r of packFailedRequests) {
    if (!failedRequests.some((f) => f.method === r.method && f.url.split('?')[0] === r.url && f.status === r.status)) failedRequests.push({ ...r, ok: false, source: 'kane-pack' });
  }
  const errors = [...new Set(page.flatMap((s) => s.errors || []))];

  const checks = truth.map((t) => {
    if (t.network === 'no-failures') return { what: 'no failed requests', expected: 'none', actual: failedRequests.length ? failedRequests.map((r) => `${r.method} ${r.url} → ${r.status}`).join('; ') : 'none', ok: failedRequests.length === 0 };
    if (t.errors === 'none') return { what: 'no JS errors', expected: 'none', actual: errors.length ? errors.join('; ') : 'none', ok: errors.length === 0 };
    const { found, value } = valueFor(last, t.key);
    let ok;
    let expected;
    if ('equals' in t) { expected = t.equals; ok = found && JSON.stringify(value) === JSON.stringify(t.equals); }
    else if ('min' in t) { expected = `at least ${t.min}`; ok = found && Number(value) >= t.min; }
    else { expected = 'present'; ok = found; }
    return { what: t.key, expected, actual: found ? value : '(not reported)', ok };
  });

  const appSaysWorking = checks.every((c) => c.ok);
  let state;
  if (verdict === 'ERROR') state = 'COULDNT_RUN';
  else if ((verdict === 'PASS') === appSaysWorking) state = 'BALANCED';
  else state = verdict === 'PASS' ? 'FALSE_GREEN' : 'FALSE_RED';
  return {
    state,
    label: BALANCE_LABEL[state],
    kane: verdict,
    app: appSaysWorking ? 'working' : 'broken',
    checks,
    failedRequests,
    errors,
    lastSnapshot: { at: new Date(last.at).toISOString(), url: last.url, values: last.values },
  };
}

// Hash of the test, its recording and its truth file, so a "fix" can't quietly change the check.
export function contractHash(testFile) {
  const h = crypto.createHash('sha256');
  const add = (f) => { if (fs.existsSync(f)) { h.update(path.basename(f)); h.update(fs.readFileSync(f)); } };
  add(testFile);
  add(truthFileFor(testFile));
  const out = path.join(path.dirname(testFile), `output-${path.basename(testFile).replace(/_test\.md$/, '').replace(/\.md$/, '')}`);
  const internal = path.join(out, '.internal');
  if (fs.existsSync(internal)) {
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).forEach((e) => {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/actions\.ndjson$|plan.*\.json$/.test(e.name)) add(p);
    });
    walk(internal);
  }
  return h.digest('hex');
}
