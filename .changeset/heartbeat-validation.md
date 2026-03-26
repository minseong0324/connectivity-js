---
"@connectivity-js/core": patch
---

Fix `heartbeatDetector` to validate `response.ok` status. Previously, any HTTP response (including 500, 403, etc.) was treated as online. Now unhealthy responses correctly emit offline status.

- Added `method` option to configure HTTP method (default: `'HEAD'`)
- Added `validateResponse` option for custom response validation
- Default validation checks `response.ok` (2xx status codes)
