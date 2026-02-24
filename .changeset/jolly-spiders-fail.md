---
"@connectivity-js/react-devtools": minor
"@connectivity-js/devtools": minor
"@connectivity-js/react": minor
"@connectivity-js/core": minor
---

**Bug fix: `onSuccess`/`onError`/`onSettled` now fire after offline queue flush**

Previously, when an action was queued while offline and later flushed, the result
was discarded and no callbacks fired. Now:

- `onSuccess(result)` and `onSettled()` are called after a successful flush
- `onError(error)` and `onSettled()` are called when a flush exhausts all retry attempts
- Intermediate retry attempts do not trigger any callbacks

**BREAKING:** `onSettled` is no longer called when a job is enqueued. It fires only
after the job reaches a terminal state (immediate execution success/error, or final
flush outcome). Code relying on `onSettled` firing at enqueue time should switch to
`onEnqueued` instead.

---

**Bug fix: `QueuedJob.lastError` now stores the original `Error` object**

`lastError` was previously storing a stringified message via `toErrorMessage()`,
silently discarding the stack trace and any custom properties on the Error object.
`lastError` is now typed `unknown` and holds the original thrown value.

---

**Bug fix: grace period fires with the latest offline reason**

When a second offline network event arrived during an active grace period timer,
the timer closure retained the first event's `reason`. The committed status change
now always reflects the most-recent event's reason.
