---
"@connectivity-js/core": minor
---

feat(core): add `maxQueueSize` option to limit queue capacity

Adds a new `maxQueueSize` option to `ConnectivityClientOptions` that throws when the queue exceeds the configured limit, preventing unbounded memory growth in long-lived offline sessions.
