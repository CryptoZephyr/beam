# Beam

**Kane checks the screen. Your app confirms it.**

[Demo video (1:26)](https://youtu.be/Cp9pHYh0asY) · [Site](https://kane-beam.vercel.app) · [npm: `kane-beam`](https://www.npmjs.com/package/kane-beam) · MCP registry: `app.vercel.kane-beam/beam`

A coding agent adds a discount code to a checkout, writes a [Kane CLI](https://www.testmuai.com/support/docs/kane-cli-introduction/) test, runs it, and gets a green. Done.

Except the total reads **$45.00** while the order is sent for **$50.00**. And the page says **"Order placed"** while `POST /api/orders` returned **500**. Kane judged what the screen showed, and the screen looked right. The agent trusted the green.

Beam is the second witness. Your app reports its own truth through a small dev-only probe. Beam then weighs every Kane verdict against that truth, and against the failed requests in Kane's own evidence pack:

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

**Any other MCP client:** add this server. It's also listed in the [MCP registry](https://registry.modelcontextprotocol.io) as `app.vercel.kane-beam/beam`.

```json
{ "mcpServers": { "beam": { "command": "npx", "args": ["-y", "kane-beam", "mcp"] } } }
```

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

## The agent loop, recorded

On the checkout demo, Claude Code had only Beam's MCP tools and a customer's complaint. It called `beam_verify`, read `order.amount: expected 45, app reported 50` and the failed `POST /api/orders`, then changed the app and nothing in the tests:

1. Charged the discounted total instead of the subtotal.
2. Added the `SAVE10` code the server didn't know about.
3. Made the page check the order request, so a failed order never says "Order placed".

It verified again and got **Balanced**. The replays cost 0 Kane credits. The transcript and both results are in `demo/checkout/evidence/`.

## What we measured about Kane

Kane's verdict depends on how a check is worded. `beam.json` holds behaviors measured on paired pages: a correct page Kane should pass and a broken page it should fail. Recordings were made on Kane 0.10.9, then replayed on 0.10.9 and 0.10.8. Every result is on the [site](https://kane-beam.vercel.app), with the code Kane recorded.

- **Plural counter ([Kane #254](https://github.com/LambdaTest/kane-cli/issues/254)):** `Verify the todo counter reads "1 item left".` passes a page that says "1 items left". `Verify the exact visible text of the todo counter is "1 item left".` fails it, as it should.
- **Saved message over a failed request:** a check on the visible "Saved" passes a page whose save request failed. Wordings that ask Kane about the request itself catch the broken page, but also fail the correct one, because Kane can't tell which request was the save. That's the gap Beam's `{ "network": "no-failures" }` truth fills.

## Limits

- Desktop Chrome web apps. The probe needs the page to run in a dev build on your machine.
- Truth is what you expose. Beam checks the values you name, the app's own requests and its JS errors, not everything the app does.
- Version columns replay recordings made with Kane 0.10.9. They test how each version replays a check, not how it would author one.
- Not every behavior in the matrix has been run yet. The site marks those as "Not run".

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
