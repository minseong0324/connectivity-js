---
"@connectivity-js/core": patch
---

`ActionObserver.execute()` now logs unhandled errors to `console.error` when no `onError` callback is provided, instead of silently swallowing them.
