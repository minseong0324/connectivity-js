# @connectivity-js/react

## 0.5.6

### Patch Changes

- Updated dependencies [[`e5b8bfa`](https://github.com/minseong0324/connectivity-js/commit/e5b8bfa4ec9b7f4cde28f64af51db3b1a0547042), [`5be4825`](https://github.com/minseong0324/connectivity-js/commit/5be4825d78f7a4d60c1b93f80ef9564dd425787b)]:
  - @connectivity-js/core@0.6.3

## 0.5.5

### Patch Changes

- fix(core): isolate listener errors in #notifyState/#notifyQueue, count only active jobs for maxQueueSize, return latest error in getCurrentResult ([#53](https://github.com/minseong0324/connectivity-js/pull/53))

  fix(react): emit useConnectivityClient provider warning only once per module lifecycle

- Updated dependencies [[`fb1d4e1`](https://github.com/minseong0324/connectivity-js/commit/fb1d4e15c879d93b847375b2f592ee3242fa99f4)]:
  - @connectivity-js/core@0.6.2

## 0.5.4

### Patch Changes

- fix: add types conditions to exports map, remove phantom react-dom peer dep, add test:types to CI ([#49](https://github.com/minseong0324/connectivity-js/pull/49))

- fix(react): clear useAction flush callbacks on unmount to prevent stale closure invocation ([#48](https://github.com/minseong0324/connectivity-js/pull/48))

- Updated dependencies [[`69f6f49`](https://github.com/minseong0324/connectivity-js/commit/69f6f498220285ad0e5ae1522e39aaba4bf69bf8), [`e8a4819`](https://github.com/minseong0324/connectivity-js/commit/e8a48196c7ab399ab84f61fb08bff54c3f734903)]:
  - @connectivity-js/core@0.6.1

## 0.5.3

### Patch Changes

- fix: add explicit `types` conditions in package.json exports for TypeScript moduleResolution bundler/node16+ ([#43](https://github.com/minseong0324/connectivity-js/pull/43))

- Updated dependencies [[`5acde6f`](https://github.com/minseong0324/connectivity-js/commit/5acde6f46286ca9540543b82476dbea1d7949078), [`5acde6f`](https://github.com/minseong0324/connectivity-js/commit/5acde6f46286ca9540543b82476dbea1d7949078), [`ffedd96`](https://github.com/minseong0324/connectivity-js/commit/ffedd963130b21d44d479f45a077213fcf9be1b2)]:
  - @connectivity-js/core@0.6.0

## 0.5.2

### Patch Changes

- Freeze sentinel objects, add getInstance() options warning, add types export condition, mark internal APIs, fix ActionObserver type cast ([#39](https://github.com/minseong0324/connectivity-js/pull/39))

- Updated dependencies [[`2b0d7c7`](https://github.com/minseong0324/connectivity-js/commit/2b0d7c74c1e3e2f5ea8d19406e4b55eac631ec86)]:
  - @connectivity-js/core@0.5.2

## 0.5.1

### Patch Changes

- Eliminate unnecessary re-renders caused by unstable Context value. ([#35](https://github.com/minseong0324/connectivity-js/pull/35))

  - Split single Context into ClientContext + DefaultOptionsContext
  - Stabilize defaultOptions reference with shallow comparison
  - Clean up onJobError handler on Provider unmount
  - Stabilize retry/cancel references in useQueue with useCallback
  - Add dev-mode warning when hooks are used outside Provider

- Updated dependencies [[`d769da9`](https://github.com/minseong0324/connectivity-js/commit/d769da92735c0ad0a46922771657b965e642d4e4), [`cfddb93`](https://github.com/minseong0324/connectivity-js/commit/cfddb93a7ed1efaba14c276411cc1268a547155d)]:
  - @connectivity-js/core@0.5.1

## 0.5.0

### Minor Changes

- **BREAKING:** `ConnectivityProvider` now accepts a `client` prop for explicit client injection. The previous `detectors` prop pattern still works but the `client` prop is recommended. ([#29](https://github.com/minseong0324/connectivity-js/pull/29))

  - `ConnectivityClient` constructor is now public — use `new ConnectivityClient(options)` directly
  - Added `stop()` method that stops detectors without clearing actions/jobs/listeners
  - Provider calls `stop()` on unmount instead of `destroy()`, preserving registered actions
  - All hooks now read the client from Context (falls back to singleton when outside Provider)
  - New `useConnectivityClient()` hook exported for direct client access
  - `destroy()` is now terminal — `start()`, `execute()`, `registerAction()`, `subscribe()`, `subscribeQueue()` throw after destroy
  - Unified `#assertNotDestroyed()` guard with actionable error messages guiding toward `resetInstance()`

### Patch Changes

- Updated dependencies [[`f88e2e9`](https://github.com/minseong0324/connectivity-js/commit/f88e2e9b8dca94aa21b31bc768b9b3c2d23e1ec1), [`8378a7e`](https://github.com/minseong0324/connectivity-js/commit/8378a7e4844947720e37da7733a7159d81cb6d35), [`c2d78bc`](https://github.com/minseong0324/connectivity-js/commit/c2d78bc9dac35c5ba007e5c688bbb0f7b9316b00)]:
  - @connectivity-js/core@0.5.0

## 0.4.0

### Minor Changes

- fix: resolve 3 critical bugs — sync config/flush request path, split execute/executeAsync (React Query mutate/mutateAsync pattern), prevent retry+flush double execution ([#18](https://github.com/minseong0324/connectivity-js/pull/18))

- refactor: extract `toRegisteredAction` utility, add `setOnJobError` setter for dynamic error handler updates ([#20](https://github.com/minseong0324/connectivity-js/pull/20))

### Patch Changes

- chore: improve caching in getCurrentResult, fix heartbeat cleanup race, fix DevTools panel positioning ([#21](https://github.com/minseong0324/connectivity-js/pull/21))

- Updated dependencies [[`19d2a19`](https://github.com/minseong0324/connectivity-js/commit/19d2a1921e131d4a79d7e7e8dded7a255813a41c), [`a130873`](https://github.com/minseong0324/connectivity-js/commit/a130873dbb90a42960ba87a4580b9217bce9f1c9), [`6f66724`](https://github.com/minseong0324/connectivity-js/commit/6f667240196aa66ce35ef83716a32b9a6c83f103)]:
  - @connectivity-js/core@0.4.0

## 0.3.0

### Minor Changes

- `client.execute()` previously accepted only a string `actionKey`, causing the ([#16](https://github.com/minseong0324/connectivity-js/pull/16))

### Patch Changes

- Updated dependencies [[`d29bfb2`](https://github.com/minseong0324/connectivity-js/commit/d29bfb2739e409b637de950481c280fe37c41e4d)]:
  - @connectivity-js/core@0.3.0

## 0.2.0

### Minor Changes

- **Bug fix: `onSuccess`/`onError`/`onSettled` now fire after offline queue flush** ([#12](https://github.com/minseong0324/connectivity-js/pull/12))

  Previously, when an action was queued while offline and later flushed, the result
  was discarded and no callbacks fired. Now:

  - `onSuccess(result)` and `onSettled()` are called after a successful flush
  - `onError(error)` and `onSettled()` are called when a flush exhausts all retry attempts
  - Intermediate retry attempts do not trigger any callbacks

  **BREAKING:** `onSettled` is no longer called when a job is enqueued. It fires only
  after the job reaches a terminal state (immediate execution success/error, or final
  flush outcome). Code relying on `onSettled` firing at enqueue time should switch to
  `onEnqueued` instead.

  ***

  **Bug fix: `QueuedJob.lastError` now stores the original `Error` object**

  `lastError` was previously storing a stringified message via `toErrorMessage()`,
  silently discarding the stack trace and any custom properties on the Error object.
  `lastError` is now typed `unknown` and holds the original thrown value.

  ***

  **Bug fix: grace period fires with the latest offline reason**

  When a second offline network event arrived during an active grace period timer,
  the timer closure retained the first event's `reason`. The committed status change
  now always reflects the most-recent event's reason.

### Patch Changes

- Updated dependencies [[`907d59e`](https://github.com/minseong0324/connectivity-js/commit/907d59ef5c7417a9b5265c3e51ca8cad16414394)]:
  - @connectivity-js/core@0.2.0

## 0.1.0

### Minor Changes

- First minor version release ([#4](https://github.com/minseong0324/connectivity-js/pull/4))

### Patch Changes

- Updated dependencies [[`3d782e9`](https://github.com/minseong0324/connectivity-js/commit/3d782e964dd8d5ab1805bfc58afcbc9bc5b10f8d)]:
  - @connectivity-js/core@0.1.0
