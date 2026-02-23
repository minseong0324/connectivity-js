---
title: Offline Behavior
description: whenOffline, execution flow, FIFO queue behavior
---

# Offline Behavior

How actions behave depending on network status.

## Default behavior

`execute()` branches automatically based on connectivity:

| State | `whenOffline` | Behavior | Return |
|---|---|---|---|
| online | — | Execute immediately | `{ enqueued: false, result }` |
| offline | `'queue'` (default) | Queue, auto-flush on reconnect | `{ enqueued: true, jobId }` |
| offline | `'fail'` | Throw immediately | — |
| unknown | `'queue'` | Queue (conservative) | `{ enqueued: true, jobId }` |
| unknown | `'fail'` | Queue (no throw — uncertainty) | `{ enqueued: true, jobId }` |

> **Why doesn't `whenOffline: 'fail'` throw in `unknown` state?**
> UI is optimistic (`unknown` → show children), but data is conservative (`unknown` → queue to prevent data loss). When connectivity is uncertain, throwing would discard user actions that might succeed moments later.

```tsx
// Default — queue when offline
const { execute } = useAction({
  actionKey: 'save',
  request: (input) => api.save(input),
});

// Must be online
const { execute } = useAction({
  actionKey: 'verify',
  request: (input) => api.verify(input),
  whenOffline: 'fail',
});
```

## Execution flow

Every `execute()` call **enqueues a job first** (always-enqueue), then branches:

```
execute(actionKey, input)
  │
  ├─ confirmed offline + whenOffline='fail'
  │   → throw (no enqueue)
  │
  ├─ enqueue job (with dedupe)
  │
  ├─ not confirmed online (offline or unknown)
  │   → { enqueued: true, jobId }
  │
  ├─ same entity already running (hasRunningDupe)
  │   → { enqueued: true, jobId }
  │
  └─ confirmed online + no dupe
      → execute immediately
      ├─ success: { enqueued: false, result }
      ├─ failure + retry: { enqueued: true, jobId }
      └─ failure + no retry: throw
```

### hasRunningDupe

If a job with the same `actionKey` + `dedupeKey` is already `running`, the new request waits in the queue instead of executing immediately. It runs automatically after the previous one completes.

This **prevents concurrent requests for the same resource**, avoiding server-side race conditions.

```
execute('save', { id: '1', data: 'v1' })  → running
execute('save', { id: '1', data: 'v2' })  → queued (v1 is running)
execute('save', { id: '2', data: 'v1' })  → running (different id, independent)
```

Actions without `dedupeKey` skip hasRunningDupe — every request executes independently.

## Auto-flush

Queued jobs are flushed in **FIFO order** when connectivity is restored:

1. Detector emits `online`
2. Grace period passes (if configured)
3. Collect `queued` jobs with `nextRunAt` in the past
4. Group by action, execute in parallel (within each action, limited by `flushOption.concurrency`)

## Job status

Each job in the queue goes through these states:

```
queued → running → succeeded → (removed after 5s)
                 → failed    → (retry: back to queued)
                              → (retries exhausted: stays failed)
queued → canceled             → (stays)
```

| Status | Description |
|---|---|
| `queued` | Waiting. Next flush or immediate execution candidate |
| `running` | In progress |
| `succeeded` | Done. Auto-removed after 5 seconds |
| `failed` | Retries exhausted. `onJobError` called |
| `canceled` | Manually canceled or stale data |

## Good to know

### Online execution also goes through the queue

Even online, `execute()` creates a job internally. This lets `pendingCount` and `useQueue` track all executions. On success, the job becomes `succeeded` and is removed after 5 seconds.

### unknown state

In `execute()`, `unknown` is treated as **offline** — actions are queued. However, `whenOffline='fail'` does NOT throw on `unknown`; throw only fires on confirmed offline.

This differs from `<Connectivity>` intentionally:
- **`<Connectivity>` (UI)**: `unknown` treated as online (optimistic — prevents fallback flicker)
- **`execute()` (Data)**: `unknown` treated as offline (conservative — prevents data loss)

Once a detector emits `online`, queued jobs flush automatically.

## Related

- [Deduplication](./deduplication.md) — collapsing duplicates with `dedupeKey`
- [Retry](../advanced/retry.md) — automatic retry on failure
- [Flush Control](../advanced/flush-control.md) — concurrency, intervalMs
- [useAction API](../api/react/use-action.md)

