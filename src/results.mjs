// results/latest.json holds the newest result for every behavior × wording × version × twin.
// results/history.jsonl keeps every single run, append-only.
import fs from 'node:fs';
import path from 'node:path';
import { RESULTS_DIR } from './paths.mjs';

const LATEST = path.join(RESULTS_DIR, 'latest.json');
const HISTORY = path.join(RESULTS_DIR, 'history.jsonl');

export function loadResults() {
  if (!fs.existsSync(LATEST)) return { updated: null, behaviors: {}, runs: [] };
  return JSON.parse(fs.readFileSync(LATEST, 'utf8'));
}

export function saveResults(results) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  results.updated = new Date().toISOString();
  const tmp = LATEST + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(results, null, 2) + '\n');
  fs.renameSync(tmp, LATEST);
}

export function appendHistory(entry) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.appendFileSync(HISTORY, JSON.stringify(entry) + '\n');
}

// Only what the site and skill need, plus the evidence a person would check.
export function slimRun(r, verdict) {
  return {
    verdict,
    at: new Date().toISOString(),
    replay: r.replay,
    authored: r.authorDecisions,
    replayed: r.replayDecisions,
    credits: r.credits,
    durationS: r.durationS,
    summary: r.summary,
    reasonCode: r.reasonCode,
    codeJs: r.codeJs,
    stored: r.stored,
    testUrl: r.testUrl,
    exitCode: r.exitCode,
    error: verdict === 'ERROR' ? r.stderrTail || r.summary || `exit ${r.exitCode}` : undefined,
  };
}

export function setRun(results, { behavior, wording, version, twin, run }) {
  const b = (results.behaviors[behavior.id] ||= { wordings: {} });
  const w = (b.wordings[wording.id] ||= { text: wording.text, origin: wording.origin, versions: {} });
  w.text = wording.text;
  w.origin = wording.origin;
  const v = (w.versions[version] ||= {});
  v[twin] = run;
  return v;
}
