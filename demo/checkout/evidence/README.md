# Checkout demo evidence

The Northwind Coffee checkout has two planted bugs: it sends the subtotal ($50) instead of the discounted total ($45), and it says "Order placed" even when `POST /api/orders` fails. Kane CLI passes it.

| File | What it shows |
|---|---|
| `result.before.json` | `kane-beam verify` on the buggy app: Kane passed, Beam says **False green** (`order.amount` 50, expected 45; `POST /api/orders` → 500). |
| `kane-pack-read.json` | What Beam read from Kane's own evidence pack on a replay (0 credits): Kane's network log holds the 500, with the request body `"amount":50`. Kane recorded the bug and still passed. |
| `beam.verdict.json` | Beam's verdict, written beside Kane's verdicts in Kane's format: `fail`, exit code 1, failed gates `order.amount` and `no-failed-requests`. |
| `../policy/kane-strict.yaml` | Kane's strictest policy. It passes the same pack, because Kane policies can't read the network log yet (Kane #243). |
| `agent-run.json` | Claude Code's run with only Beam's MCP tools: 16 turns, its final summary of the three fixes. |
| `app.before.js`, `app.after.js` | The app code before and after the agent's fix. The tests weren't touched. |
| `codes.before.txt`, `codes.after.txt` | The server's discount codes before and after (the agent added `SAVE10`). |
| `result.after.json` | `kane-beam verify` after the fix: **Balanced**. |
| `mcp-config.json` | The MCP config the agent ran with. |
