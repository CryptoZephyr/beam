// One Beam verify: run a Kane test against the app and weigh Kane's verdict against the app's truth.
import fs from 'node:fs';
import path from 'node:path';
import { ensureBridge, getSnapshots, resetSnapshots, BRIDGE_PORT } from './bridge.mjs';
import { readTruth, weigh, contractHash, truthFileFor } from './balance.mjs';
import { runTest, verdictOf } from './kane.mjs';
import { referenceKane } from './versions.mjs';
import { packTruth } from './pack.mjs';

// Beam's balance as a Kane verdict document, written beside Kane's own verdicts for this pack.
function writeBeamVerdict(packPath, result) {
  const dir = `${packPath}.verdicts`;
  fs.mkdirSync(dir, { recursive: true });
  const gates = result.checks.map((c, i) => ({ id: `beam-${i + 1}-${String(c.what).replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 40)}`, expr: `app truth: ${c.what}`, op: 'equals', expected: c.expected, actual: c.actual, severity: 'blocking', status: c.ok ? 'pass' : 'fail' }));
  const doc = {
    result: result.state === 'BALANCED' ? 'pass' : result.state === 'COULDNT_RUN' ? 'errored' : 'fail',
    exit_code: result.state === 'BALANCED' ? 0 : result.state === 'COULDNT_RUN' ? 3 : 1,
    evaluated_at: result.at,
    evaluator: { name: 'kane-beam', kane_verdict: result.kane, balance: result.state },
    pack: { path: path.basename(packPath) },
    policy: { id: 'beam' },
    failed_gates: gates.filter((g) => g.status === 'fail').map((g) => g.id),
    warnings: [], errored_gates: [], gates,
  };
  const f = path.join(dir, 'beam.verdict.json');
  fs.writeFileSync(f, JSON.stringify(doc, null, 2) + '\n');
  return f;
}

const lockFileFor = (testFile) => testFile.replace(/\.md$/, '.beam-lock.json');
const resultFileFor = (testFile) => testFile.replace(/\.md$/, '.beam-result.json');

export async function verify(testFile, { replayOnly = true, headed = false, acceptChanges = false, onStep } = {}) {
  const file = path.resolve(testFile);
  if (!fs.existsSync(file)) throw new Error(`No test file at ${testFile}`);
  const truth = readTruth(file);

  // The check must stay the same between runs, so a "fix" lands in the app, not in the test.
  const lockFile = lockFileFor(file);
  const before = contractHash(file);
  if (fs.existsSync(lockFile) && !acceptChanges) {
    const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
    if (lock.hash !== before) {
      return { state: 'CHANGED', label: 'Test changed', note: `${path.basename(file)}, its recording or ${path.basename(truthFileFor(file))} changed since the last verify. Fix the app instead, or rerun with --accept-changes if the change was intended.`, test: path.basename(file) };
    }
  }

  const bridge = await ensureBridge();
  try {
    await resetSnapshots();
    const kane = referenceKane();
    const run = await runTest(kane, file, { replay: replayOnly, headed, onStep });
    const verdict = verdictOf(run);
    const snaps = await getSnapshots();
    let pack = null;
    if (run.packPath && fs.existsSync(run.packPath)) {
      try { pack = packTruth(run.packPath, { ignoreHosts: [`127.0.0.1:${BRIDGE_PORT}`, `localhost:${BRIDGE_PORT}`] }); } catch (e) { pack = { error: String(e.message || e) }; }
    }
    const result = {
      test: path.basename(file),
      at: new Date().toISOString(),
      kaneVersion: kane.version,
      ...weigh(verdict, snaps, truth, { packFailedRequests: pack?.failedRequests || [] }),
      kaneRun: { summary: run.summary, testUrl: run.testUrl, credits: run.credits || 0, replayed: run.replayDecisions, authored: run.authorDecisions, codeJs: run.codeJs },
      kanePack: pack ? { file: run.packPath && path.basename(run.packPath), failedRequests: pack.failedRequests, consoleErrors: pack.consoleErrors, error: pack.error } : null,
    };
    if (run.packPath && fs.existsSync(run.packPath) && result.checks) result.beamVerdictFile = writeBeamVerdict(run.packPath, result);
    if (!fs.existsSync(lockFile) || acceptChanges) fs.writeFileSync(lockFile, JSON.stringify({ hash: contractHash(file), at: result.at }, null, 2) + '\n');
    fs.writeFileSync(resultFileFor(file), JSON.stringify(result, null, 2) + '\n');
    return result;
  } finally {
    await bridge.close();
  }
}

export function formatResult(r) {
  if (r.state === 'CHANGED') return `${r.label}: ${r.note}`;
  const lines = [`${r.label}: Kane ${r.kane === 'PASS' ? 'passed' : r.kane === 'FAIL' ? 'failed' : "couldn't run"}, the app says it's ${r.app}.`];
  for (const c of r.checks || []) lines.push(`  ${c.ok ? 'ok ' : 'NO '} ${c.what}: expected ${JSON.stringify(c.expected)}, app reported ${JSON.stringify(c.actual)}`);
  if (r.note) lines.push(`  ${r.note}`);
  if (r.kaneRun?.testUrl) lines.push(`  Kane run: ${r.kaneRun.testUrl}`);
  return lines.join('\n');
}
