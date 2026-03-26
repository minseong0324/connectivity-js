---
"@connectivity-js/core": patch
---

Fix silent error swallowing in `ActionObserver.execute()`. Previously, errors were caught and discarded with `.catch(() => {})`. Now unhandled errors are logged via `console.error` with a descriptive message when no `onError` callback is provided.
