# Retry

Automatic retry for failed actions.

## Why

Network requests can fail due to transient server errors (500), timeouts, or brief disconnections. Auto-retry recovers from these without user intervention.

## Configuration

```ts
const saveAction = actionOptions({
  actionKey: 'save',
  request: (input: { id: string; data: string }) => api.save(input),
  retry: {
    maxAttempts: 3,
    backoffMs: (attempt) => attempt * 1_000, // 1s, 2s, 3s
  },
});
```

### RetryPolicy

| Field | Type | Description |
|---|---|---|
| `maxAttempts` | `number` | Max attempts (including first execution) |
| `backoffMs` | `(attempt: number) => number` | Delay based on attempt count (ms) |

## Behavior

```
Attempt 1 → fail → backoffMs(1) wait → Attempt 2 → fail → backoffMs(2) wait → Attempt 3 → fail → failed
```

1. On failure, if `maxAttempts` not reached: job returns to `queued`
2. Waits `backoffMs(currentAttempt)`, then retries
3. On reaching `maxAttempts`: transitions to `failed`
4. On `failed`: `onJobError` callback fires

### Offline during retry

If connectivity drops during a retry wait, the retry won't execute even after the timer expires. The job will be picked up again on the next flush after going back online.

### Retry + dedupe

If a new request with the same `dedupeKey` arrives while a job is in retry (queued), the existing job's `input` is replaced. Retry will send the latest data.

## Backoff patterns

```ts
// Linear
backoffMs: (attempt) => attempt * 1_000    // 1s, 2s, 3s

// Exponential
backoffMs: (attempt) => 2 ** attempt * 500 // 1s, 2s, 4s

// Fixed
backoffMs: () => 3_000                     // always 3s

// Jitter (server load distribution)
backoffMs: (attempt) => attempt * 1_000 + Math.random() * 500
```

## onJobError

Called when a job exhausts all retries during flush. Use for error monitoring (e.g. Sentry):

```tsx
<ConnectivityProvider
  detectors={[...]}
  onJobError={(error, job) => {
    Sentry.captureException(error, {
      extra: {
        jobId: job.id,
        actionKey: job.actionKey,
        attempt: job.attempt,
      },
    });
  }}
>
  <App />
</ConnectivityProvider>
```

`onJobError` fires during **flush** when all retries are exhausted. For `execute()` failures, use `useAction`'s `onError` callback.

## Related

- [Offline Behavior](../guide/offline-behavior.md)
- [useAction API](../api/react/use-action.md)
- [ConnectivityClient API](../api/core/connectivity-client.md)

