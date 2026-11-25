// Turns one behavior wording into a Kane _test.md. Every wording of a behavior shares the same
// setup steps, so wordings differ only in the check sentence.
import fs from 'node:fs';
import path from 'node:path';
import { RUNS_DIR } from './paths.mjs';
import { fixtureUrl } from './fixture-server.mjs';

export function testFilePath(behaviorId, wordingId) {
  return path.join(RUNS_DIR, behaviorId, `${wordingId}_test.md`);
}

export function renderTest(behavior, wording) {
  const lines = [];
  if (behavior.steps) lines.push(behavior.steps.trim());
  lines.push(wording.text.trim());
  return [
    '---',
    'mode: testing',
    'headless: true',
    `url: ${fixtureUrl(behavior.id)}`,
    '---',
    '',
    `# ${behavior.title}`,
    '',
    '## Check',
    ...lines,
    '',
  ].join('\n');
}

// Writes the file only when its content changed, so an unchanged wording keeps its recording.
export function writeTest(behavior, wording) {
  const file = testFilePath(behavior.id, wording.id);
  const text = renderTest(behavior, wording);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (prev !== text) fs.writeFileSync(file, text);
  return { file, changed: prev !== text };
}

export function hasRecording(behaviorId, wordingId) {
  const out = path.join(RUNS_DIR, behaviorId, `output-${wordingId}`);
  return fs.existsSync(out) && fs.readdirSync(out).length > 0;
}
