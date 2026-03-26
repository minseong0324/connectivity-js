---
"@connectivity-js/core": patch
---

Fix quality change notifications being silently dropped during grace period.

- Notify subscribers of quality changes even when grace period timer is active
- Add destroyed guard to grace period timer callback
