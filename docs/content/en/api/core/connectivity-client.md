# ConnectivityClient

Singleton client that detects connectivity, manages offline action queueing, retry, and deduplication.

## Creating an instance

```ts
import { ConnectivityClient, getConnectivityClient } from '@connectivity-js/core';

// Option 1: static method
const client = ConnectivityClient.getInstance(options);

// Option 2: shorthand (identical)
const client = getConnectivityClient(options);
```

`options` apply only on the first call. Subsequent calls return the existing instance.

### ConnectivityClientOptions

| Field | Type | Default | Description |
|---|---|---|---|
| `detectors` | `Detector[]` | (required) | Connectivity detection strategies |
| `initialStatus` | `ConnectivityStatus` | `'unknown'` | Initial state |
| `gracePeriodMs` | `number` | `0` | Grace period before offline transition (ms) |
| `onJobError` | `(error, job) => void` | — | Called when a job reaches terminal failure |
| `maxQueueSize` | `number` | `undefined` | Maximum number of jobs allowed in the queue. Throws when exceeded. |
| `defaultOptions.actions` | `ActionOptions` | — | Global action defaults |

## Methods

### `start()`

Activates registered detectors. Auto-called by `ConnectivityProvider`. Duplicate calls are no-ops. Throws if the client has been destroyed.

```ts
client.start();
```

### `stop()`

Stops all detectors without clearing actions, jobs, or listeners. Auto-called on `ConnectivityProvider` unmount. Call `start()` to resume.

```ts
client.stop();
// later…
client.start(); // detectors resume, actions/jobs preserved
```

### `destroy()`

**Terminal.** Stops detectors and clears all actions, jobs, and listeners. After `destroy()`, `start()` and `execute()` will throw. Use `resetInstance()` for singletons or create a new instance.

```ts
client.destroy();
```

### `getState()`

Returns an immutable snapshot of current connectivity state.

```ts
const state = client.getState();
// { status: 'online', since: 1700000000000, quality: { rttMs: 42 } }
```

### `subscribe(listener)`

Subscribes to connectivity state changes.

```ts
const unsubscribe = client.subscribe((state, transition) => {
  console.log(state.status, transition?.from, '→', transition?.to);
});
```

| Parameter | Type |
|---|---|
| `listener` | `(state: ConnectivityState, transition?: ConnectivityTransition) => void` |
| Returns | `() => void` (unsubscribe) |

### `registerAction(actionKey, action)`

Registers an action. Re-registering the same key overwrites the previous one.

```ts
client.registerAction('save', {
  request: (input) => api.save(input),
  options: {
    whenOffline: 'queue',
    retry: { maxAttempts: 3, backoffMs: (n) => n * 1_000 },
    dedupeKey: (input) => (input as { id: string }).id,
  },
});
```

### `execute(actionKey, input)`

Executes a registered action. Supports two call styles:

**String key (backward compatible):**

```ts
const result = await client.execute('save', { id: '1', data: 'hello' });
if (result.enqueued) {
  console.log(result.jobId);
} else {
  console.log(result.result);
}
```

| Parameter | Type |
|---|---|
| `actionKey` | `string` |
| `input` | `unknown` |
| Returns | `Promise<{ enqueued: true; jobId: string } \| { enqueued: false; result: unknown }>` |

**Type-safe with `actionOptions()`:**

Pass an `actionOptions()` config to get fully inferred `TInput` and `TResult`. The action is auto-registered if not already present.

```ts
import { actionOptions } from '@connectivity-js/core';

const saveAction = actionOptions({
  actionKey: 'save',
  request: (input: { id: string; data: string }) => api.save(input),
  whenOffline: 'queue',
  dedupeKey: (input) => input.id,
});

const result = await client.execute(saveAction, { id: '1', data: 'hello' });
if (!result.enqueued) {
  console.log(result.result); // fully typed as the return of api.save()
}
```

### `getQueue()`

Returns a snapshot of the entire job queue.

```ts
const jobs = client.getQueue();
```

### `getActionQueue(actionKey)`

Returns jobs for a specific action. Returns the same reference if unchanged.

```ts
const saveJobs = client.getActionQueue('save');
```

### `subscribeQueue(listener)`

Subscribes to job queue changes.

```ts
const unsubscribe = client.subscribeQueue(() => {
  const jobs = client.getQueue();
  console.log('queued:', jobs.filter(j => j.status === 'queued').length);
});
```

### `retry(jobId)`

Retries a failed or queued job. Resets the attempt counter to 0, allowing the full retry cycle.

```ts
await client.retry('job_1_1700000000000');
```

### `cancel(jobId)`

Cancels a queued job.

```ts
client.cancel('job_1_1700000000000');
```

### `flush(options?)`

Manually flushes pending jobs.

```ts
await client.flush();
await client.flush({ onlyActionKey: 'save' });
```

### `setOnJobError(handler)`

Updates the error handler called when a job fails during flush. Used by `ConnectivityProvider` to track the latest `onJobError` callback via ref. Pass `undefined` to remove the handler.

```ts
client.setOnJobError((error, job) => {
  console.error(`Job ${job.id} failed:`, error);
  reportError(error);
});
```

| Parameter | Type |
|---|---|
| `handler` | `((error: unknown, job: QueuedJob) => void) \| undefined` |

### `resetInstance()` (static)

Destroys the singleton. **Testing only.**

```ts
afterEach(() => {
  ConnectivityClient.resetInstance();
});
```

## Related

- [Actions](../guide/actions.md)
- [ConnectivityProvider API](./connectivity-provider.md)
- [Testing Guide](../advanced/testing.md)

