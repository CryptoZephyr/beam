# The loop, recorded 26 Nov 2026

A clean copy of the buggy checkout (no evidence folder, no old results), with the published `kane-beam` 0.1.1.

1. `loop-1-verify.txt`: `kane-beam verify tests/checkout_test.md`. Kane replays the test and passes. Beam: **False green** (`order.amount` 50 not 45, `POST /api/orders` → 500). Exit 1.
2. `loop-2-agent.ndjson`: Claude Code's full transcript (stream-json). It got Beam's report and only file tools. It changed `public/app.js` (`subtotal()` → `total()`) and `codes.txt` (+ `SAVE10`), and no tests.
3. `loop-3-verify.txt`: the same verify after the fix: **Balanced**. Exit 0. Both verifies were replays at 0 Kane credits.

Local paths in the transcript are shortened to `~`.
