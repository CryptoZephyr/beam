import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weigh } from '../src/balance.mjs';
import { isLoopbackOrigin } from '../src/bridge.mjs';

const snap = (values, extra = {}) => ({ page: 'p1', seq: 1, at: Date.now(), url: 'http://127.0.0.1:4319/', values, storage: {}, network: [], errors: [], ...extra });
const truth = [{ key: 'counter.text', equals: '1 item left' }, { key: 'todos.count', equals: 1 }];

test('Kane passed, app contradicts: false green with the exact value', () => {
  const r = weigh('PASS', [snap({ 'counter.text': '1 items left', 'todos.count': 1 })], truth);
  assert.equal(r.state, 'FALSE_GREEN');
  assert.deepEqual(r.checks.map((c) => c.ok), [false, true]);
  assert.equal(r.checks[0].actual, '1 items left');
});

test('both pans agree: balanced', () => {
  assert.equal(weigh('PASS', [snap({ 'counter.text': '1 item left', 'todos.count': 1 })], truth).state, 'BALANCED');
  assert.equal(weigh('FAIL', [snap({ 'counter.text': '1 items left', 'todos.count': 1 })], truth).state, 'BALANCED');
});

test('Kane failed a working app: false red', () => {
  assert.equal(weigh('FAIL', [snap({ 'counter.text': '1 item left', 'todos.count': 1 })], truth).state, 'FALSE_RED');
});

test('a failed request the UI hid makes a pass a false green', () => {
  const s = snap({ 'order.status': 'placed' }, { network: [{ method: 'POST', url: 'http://127.0.0.1:4319/api/orders', status: 500, ok: false, at: 1 }] });
  const r = weigh('PASS', [s], [{ network: 'no-failures' }]);
  assert.equal(r.state, 'FALSE_GREEN');
  assert.match(r.checks[0].actual, /500/);
});

test('only the last page load counts', () => {
  const old = snap({ 'counter.text': '1 items left' }, { page: 'old' });
  const now = snap({ 'counter.text': '1 item left' }, { page: 'new' });
  assert.equal(weigh('PASS', [old, now], [{ key: 'counter.text', equals: '1 item left' }]).state, 'BALANCED');
});

test('no snapshots and Kane errors are never a verdict', () => {
  assert.equal(weigh('PASS', [], truth).state, 'NO_PROBE');
  assert.equal(weigh('ERROR', [snap({})], truth).state, 'COULDNT_RUN');
});

test('a value the app never reported is not a match', () => {
  const r = weigh('PASS', [snap({})], [{ key: 'cart.total', equals: 45 }]);
  assert.equal(r.state, 'FALSE_GREEN');
  assert.equal(r.checks[0].actual, '(not reported)');
});

test('bridge accepts only pages on this machine', () => {
  for (const o of ['http://127.0.0.1:4319', 'http://localhost:3000', 'http://app.localhost:5173', undefined]) assert.ok(isLoopbackOrigin(o), String(o));
  for (const o of ['https://evil.example', 'http://192.168.1.5:3000', 'http://localhost.evil.com', 'null']) assert.ok(!isLoopbackOrigin(o), o);
});
