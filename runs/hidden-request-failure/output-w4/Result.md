---
test: ../w4_test.md
status: failed
started: 2026-11-26T13:07:49.577Z
duration_s: 105
session_id: 967ef74a-b6e4-4ceb-97f0-510eea50d03a
---

# Saved message despite failed request — Result

## Check ✗ failed (64.1s)
md5: 89da43bb4daa1631611854518242ada8
Reason: The save request status could not be verified because captured network queries timed out. — bug verdict: Save reports success after required data request returns 404 [application_issue/functional_defect, confidence 0.99]
Click "Save".
Assert that the status message's exact visible text is "Saved" in its green success styling and that the request the save made for its data file completed successfully with a 2xx status.
