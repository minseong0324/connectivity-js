---
"@connectivity-js/core": minor
---

**BREAKING:** `heartbeatDetector` now validates `response.ok` by default. HTTP 5xx responses are treated as offline. Use `validateResponse: () => true` to restore the previous behavior. Added `method` and `validateResponse` options.
