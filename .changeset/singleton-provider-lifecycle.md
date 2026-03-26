---
"@connectivity-js/core": minor
"@connectivity-js/react": minor
---

**BREAKING:** `ConnectivityProvider` now accepts a `client` prop for explicit client injection. The previous `detectors` prop pattern still works but the `client` prop is recommended.

- `ConnectivityClient` constructor is now public — use `new ConnectivityClient(options)` directly
- Added `stop()` method that stops detectors without clearing actions/jobs/listeners
- Provider calls `stop()` on unmount instead of `destroy()`, preserving registered actions
- All hooks now read the client from Context (falls back to singleton when outside Provider)
- New `useConnectivityClient()` hook exported for direct client access
- `destroy()` is now terminal — `start()`, `execute()`, `registerAction()`, `subscribe()`, `subscribeQueue()` throw after destroy
- Unified `#assertNotDestroyed()` guard with actionable error messages guiding toward `resetInstance()`
