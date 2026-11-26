---
test: ../w3_test.md
status: failed
started: 2026-11-26T13:01:07.568Z
duration_s: 125
session_id: 48fb29b9-1ae7-42a7-a0d3-134eb2e297e2
---

# Saved message despite failed request — Result

## Check ✗ failed (84.2s)
md5: 95d2cc6afc34207b5568168c075f1192
Reason: AP determined agent is stuck — no viable actions remain — bug verdict: Save verification fails to recognize the successful request [automation_bug/state_transition_bug, confidence 0.94]
Click "Save".
Verify that the save request triggered by the Save click returned an HTTP 200 response and that the exact visible text of the status message is "Saved".
