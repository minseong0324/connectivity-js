---
"@connectivity-js/core": patch
---

fix(core): resolve pending flush promises on destroy, fix orphaned jobs in flushQueue

- `destroy()` now resolves pending `waitForFlushComplete()` promises before clearing, preventing callers from hanging forever.
- Replaced `processedActionKeys` Set guard in `#flushQueue` with a simple pending-jobs check, ensuring jobs enqueued during flush for the same actionKey are not orphaned.
- Removed redundant `void this.#flushQueue()` calls in terminal failure states where no pending jobs exist.
