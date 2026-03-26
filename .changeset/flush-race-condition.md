---
"@connectivity-js/core": patch
---

Fix race condition where concurrent flushQueue calls could process the same job twice.

- Single-flight guard prevents duplicate flush execution
- Fresh-read job state after async boundaries in processJob
- Enforce minimum 1ms backoff to prevent infinite retry loops
- Skip queue notification when snapshot is unchanged
