# @connectivity-js/core

## 0.4.0

### Minor Changes

- fix: resolve 3 critical bugs — sync config/flush request path, split execute/executeAsync (React Query mutate/mutateAsync pattern), prevent retry+flush double execution ([#18](https://github.com/minseong0324/connectivity-js/pull/18))

- refactor: extract `toRegisteredAction` utility, add `setOnJobError` setter for dynamic error handler updates ([#20](https://github.com/minseong0324/connectivity-js/pull/20))

### Patch Changes

- chore: improve caching in getCurrentResult, fix heartbeat cleanup race, fix DevTools panel positioning ([#21](https://github.com/minseong0324/connectivity-js/pull/21))

## 0.3.0

### Minor Changes

- `client.execute()` previously accepted only a string `actionKey`, causing the ([#16](https://github.com/minseong0324/connectivity-js/pull/16))

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

## 0.1.0

### Minor Changes

- First minor version release ([#4](https://github.com/minseong0324/connectivity-js/pull/4))
