---
name: kane-beam
description: Use whenever you build or fix a feature that a Kane CLI test checks, or write a Kane objective or *_test.md step. Beam weighs Kane's verdict against the app's own truth (values the app exposes, its request status codes, JS errors), so a Kane pass can't hide a broken app. Also lists Kane wordings that are measured to pass broken pages.
---

# Beam: Kane checks the screen, your app confirms it

Kane CLI judges what the page shows. The screen can look right while the app is wrong: a total that reads $45.00 while the order is sent for $50.00, or "Order placed" over a request that failed with a 500. Beam adds a second pan to the scale. The app reports its own truth through the Beam probe, and every Kane verdict is weighed against it.

You have Beam's MCP tools: `beam_verify`, `beam_app_state`, `beam_app_history`, `beam_check_wording`.

## The loop, every time you build or fix a feature with a Kane test

1. **Expose the truth next to the feature.** In the app code you're writing, add one line per fact the feature depends on:
   ```js
   if (window.beam) beam.expose('order.amount', () => lastOrder.amount);
   ```
   Expose what the code *knows* (state, the amount actually sent, the saved record), not what the screen shows. If the page doesn't load the probe yet, run `npx kane-beam init` once.
2. **Write the Kane test** (`name_test.md`) for the user flow. Look up your check sentence with `beam_check_wording` first and use the measured wording when there is one.
3. **Declare the truth** in `name_test.beam.json`, next to the test:
   ```json
   { "truth": [ { "key": "order.amount", "equals": 45 }, { "network": "no-failures" }, { "errors": "none" } ] }
   ```
   Always include `{ "network": "no-failures" }`: it catches failed requests the UI hides, with no extra code.
4. **Call `beam_verify`** with the test file. Use `record: true` only the first time, when the test has no recording yet (it costs Kane credits). After that, replays are free.
5. **Read the result.**
   - **Balanced:** Kane and the app agree. Done.
   - **False green:** Kane passed but the app says broken. The checks list says which value disagrees and the failed requests. Fix the **app**.
   - **False red:** Kane failed but the app says working. Look at Kane's summary: the check is probably worded wrong, or the flow didn't happen.
   - **Test changed:** you edited the test, its recording or its truth file. Put it back and fix the app instead.
6. **Never edit the test, its `output-*` folder or its `.beam.json` to make a result go green.** Beam refuses runs where they changed. The fix belongs in the app.
7. **Tell the user in one line** what Beam found and what you changed, for example:
   `Beam: Kane passed, but the app sent 50 instead of 45 and POST /api/orders returned 500. Fixed both; now Balanced.`

## Wordings

`beam.json` (next to this file) lists Kane wordings measured on pages with known answers. If `beam_check_wording` says a wording is a known false green, use the recommended one. The general rule: ask for the **exact visible text** of an element, not what it "reads" or "shows".

Full results, demo apps and the Kane runs behind them: https://kane-beam.vercel.app
