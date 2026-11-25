// One Beam verify: run a Kane test against the app and weigh Kane's verdict against the app's truth.
import fs from 'node:fs';
import path from 'node:path';
import { ensureBridge, getSnapshots, resetSnapshots } from './bridge.mjs';
import { readTruth, weigh, contractHash, truthFileFor } from './balance.mjs';
import { runTest, verdictOf } from './kane.mjs';
import { referenceKane } from './versions.mjs';

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
    const result = {
      test: path.basename(file),
      at: new Date().toISOString(),
      kaneVersion: kane.version,
      ...weigh(verdict, snaps, truth),
      kaneRun: { summary: run.summary, testUrl: run.testUrl, credits: run.credits || 0, replayed: run.replayDecisions, authored: run.authorDecisions, codeJs: run.codeJs },
    };
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
