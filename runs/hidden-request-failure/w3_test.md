---
mode: testing
headless: true
url: http://127.0.0.1:4318/f/hidden-request-failure/
---

# Saved message despite failed request

## Check
Click "Save".
Verify that the save request triggered by the Save click returned an HTTP 200 response and that the exact visible text of the status message is "Saved".
