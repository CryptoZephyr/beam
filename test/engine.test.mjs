import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseStream, verdictOf } from '../src/kane.mjs';
import { gradeWording, gradeBehavior } from '../src/grade.mjs';
import { renderTest } from '../src/testfile.mjs';
import { validateManifest } from '../src/behaviors.mjs';

const fx = (n) => fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', n), 'utf8');

test('parses a recording that passed', () => {
  const r = parseStream(fx('record-pass.ndjson'));
  assert.equal(verdictOf(r), 'PASS');
  assert.equal(r.authorDecisions, 1);
  assert.ok(r.credits > 10);
});

test('parses the #254 false green replay and its code_js', () => {
  const r = parseStream(fx('replay-false-green.ndjson'));
  assert.equal(verdictOf(r), 'PASS');
  assert.equal(r.replayDecisions, 1);
  assert.equal(r.authorDecisions, 0);
});

test('parses a failing replay', () => {
  assert.equal(verdictOf(parseStream(fx('replay-fail.ndjson'))), 'FAIL');
});

test('picks up network evidence from a failure summary', () => {
  const r = parseStream(fx('s2-onred.ndjson'));
  assert.ok(r.evidence.some((e) => e.includes('503')));
});

test('no summary means ERROR, never a verdict', () => {
  assert.equal(verdictOf(parseStream('')), 'ERROR');
});

test('grading', () => {
  assert.equal(gradeWording({ correct: 'PASS', broken: 'FAIL' }), 'CORRECT');
  assert.equal(gradeWording({ correct: 'PASS', broken: 'PASS' }), 'FALSE_GREEN');
  assert.equal(gradeWording({ correct: 'FAIL', broken: 'FAIL' }), 'FALSE_RED');
  assert.equal(gradeWording({ correct: 'ERROR', broken: 'FAIL' }), 'ERROR');
  assert.equal(gradeWording({ correct: 'PASS' }), 'NOT_RUN');
  assert.deepEqual(gradeBehavior({ w1: 'FALSE_GREEN', w2: 'CORRECT' }), { state: 'FIXED_BY_WORDING', recommended: 'w2' });
  assert.deepEqual(gradeBehavior({ w1: 'CORRECT', w2: 'CORRECT' }), { state: 'CORRECT', recommended: 'w1' });
  assert.deepEqual(gradeBehavior({ w1: 'FALSE_GREEN', w2: 'FALSE_GREEN' }), { state: 'FALSE_GREEN', recommended: null });
});

test('test file has url, steps and the wording', () => {
  const md = renderTest({ id: 'x', title: 'T', steps: 'Press Enter.' }, { text: 'Verify it.' });
  assert.match(md, /url: http:\/\/127\.0\.0\.1:\d+\/f\/x\//);
  assert.match(md, /## Check\nPress Enter\.\nVerify it\./);
});

test('manifest validation', () => {
  assert.deepEqual(validateManifest({ id: 'ok', title: 'a', summary: 'b', what_differs: 'c', wordings: [{ id: 'w1', text: 't' }] }), []);
  assert.ok(validateManifest({ id: 'Bad Id', wordings: [] }).length >= 2);
});
