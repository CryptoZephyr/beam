---
mode: testing
headless: true
url: http://127.0.0.1:4318/f/hidden-request-failure/
---

# Saved message despite failed request

## Check
Click "Save".
Assert that the status message's exact visible text is "Saved" in its green success styling and that the request the save made for its data file completed successfully with a 2xx status.
