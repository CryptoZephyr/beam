# Beam

**Kane checks the screen. Your app confirms it.**

[Kane CLI](https://www.testmuai.com/support/docs/kane-cli-introduction/) judges a web app by what the page shows. The page can look right while the app is wrong:

- The total reads **$45.00**, but the order is sent for **$50.00**.
- The page says **"Order placed"**, but `POST /api/orders` returned **500**.

Kane passes both. Beam is the second witness. Your app reports its own truth through a small dev-only probe. Beam then weighs every Kane verdict against that truth, and against the failed requests in Kane's own evidence pack:

| Kane says | App says | Beam says |
|---|---|---|
| pass | working | **Balanced** |
| pass | broken | **False green**: fix the app |
| fail | working | **False red**: the check is probably worded wrong |
| couldn't run | any | **Couldn't run** |

Your coding agent (Claude Code, Cursor or Codex) runs this loop for you through Beam's MCP server: build the feature, verify it, read what disagreed, fix the app, and verify again until it's Balanced.

## Install

You need Node 20+ and [Kane CLI](https://www.testmuai.com/support/docs/kane-cli-introduction/) signed in (`kane-cli login`).

```powershell
npx kane-beam install
```

This adds the Beam skill and registers the `beam` MCP server for the agents it finds:

- **Claude Code:** `claude mcp add --scope user`
- **Cursor:** `~/.cursor/mcp.json`
- **Codex:** `config.toml`

Run `npx kane-beam where` to see what it changed, and `npx kane-beam uninstall` to undo it all.

## Use it in 4 steps

**1. Add the probe to your app's dev build** (once per app):

```powershell
npx kane-beam init
```

This adds one script tag (or a loader behind `import.meta.env.DEV`). The probe only runs on a page served from your own machine. It reports to a bridge on `127.0.0.1:4330`, which checks the address and a token you never have to handle.

**2. Expose what the code knows**, next to the feature:

```js
if (window.beam) {
  beam.expose('cart.total', () => total());
  beam.expose('order.amount', () => lastOrder.amount);
}
```

Expose the code's own values (state, the amount actually sent, the saved record), not what the screen shows. The probe also records failed requests and JS errors without any extra code.

**3. Declare the truth** beside your Kane test, as `name_test.beam.json`:

```json
{ "truth": [
  { "key": "order.amount", "equals": 45 },
  { "network": "no-failures" },
  { "errors": "none" }
] }
```

Each truth item takes one of these forms: `equals`, `min` (at least this number), `present: true`, `network: "no-failures"` and `errors: "none"`.

**4. Verify:**

```powershell
npx kane-beam verify tests/checkout_test.md --record
```

- **`--record`:** use it only the first time. Kane writes the test's recording, which costs credits.
- **Without it:** later runs replay the recording, which costs nothing.

Or just ask your agent to "verify the checkout with Beam". The agent calls `beam_verify` itself.

```
False green: Kane passed, the app says it's broken.
  ok  cart.total: expected 45, app reported 45
  NO  order.amount: expected 45, app reported 50
  NO  no failed requests: expected "none", app reported "POST http://127.0.0.1:4402/api/orders → 500"
```

## What it guards

- **The fix lands in the app, not the test.** Beam hashes the test, its recording and its truth file into `name_test.beam-lock.json`. If any of them change, Beam refuses the run with **Test changed**. Use `--accept-changes` when the change was intended.
- **It fills a gap in Kane's policies.** Kane's verdict policies can't check the network log or the console yet ([Kane #243](https://github.com/LambdaTest/kane-cli/issues/243)). Even Kane's strictest policy passes the demo checkout run above. Beam reads the HAR inside Kane's own `.evidence` pack. It then writes `beam.verdict.json` beside Kane's verdicts, in the same format, so CI can gate on it.
- **Your app's data stays out of Kane's pack.** The probe reports over a local WebSocket, so the values it sends and its token never appear in Kane's recorded network log.
- **It knows which wordings are risky.** `beam.json` lists Kane check wordings measured on paired pages, one correct and one broken. Some wordings pass the broken page (a measured false green). `beam_check_wording` gives your agent the wording that works.

## MCP tools

| Tool | What it does |
|---|---|
| `beam_verify` | Runs a Kane test and returns the balance, each check and the failed requests |
| `beam_app_state` | The app's latest reported values |
| `beam_app_history` | Snapshots over time, for "when did it go wrong?" |
| `beam_check_wording` | Whether a Kane check wording is a measured false green, and the safer wording |

## Try the demo

```powershell
git clone https://github.com/CryptoZephyr/beam; cd beam
node demo/checkout/server.mjs
```

```powershell
node bin/kane-beam.mjs verify demo/checkout/tests/checkout_test.md --record
```

The checkout has two bugs: it sends the subtotal instead of the discounted total, and it ignores a failed order request. Kane passes it, and Beam says **False green**. Run `npm run lab` to watch the same verify live in the browser at `localhost:4317`.

## Develop

```powershell
npm test
```

| Command | What it does |
|---|---|
| `npm test` | Unit tests (engine, balance, pack reader) |
| `npm run suite` | Re-measures the wording matrix against real Kane runs (costs credits) |
| `npm run site` | Builds the static site |
| `npm run lab` | Runs the site locally, with live verify |

No runtime dependencies.

## License

MIT
