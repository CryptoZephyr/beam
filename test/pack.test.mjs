import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packPathFrom } from '../src/pack.mjs';

test('finds the pack path Kane prints', () => {
  const p = String.raw`C:\Users\dev\.testmuai\kaneai\sessions\a1\evidence\b2.evidence`;
  const err = `Running on: Desktop · Chrome\nevidence: view locally with \`kane-cli evidence serve ${p}\`\n`;
  assert.equal(packPathFrom(err), p);
  assert.equal(packPathFrom('nothing here'), null);
});
