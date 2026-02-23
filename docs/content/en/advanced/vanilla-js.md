# Without React

The core of Connectivity is framework-agnostic. Use it directly without React.

## Basic usage

```ts
import {
  getConnectivityClient,
  browserOnlineDetector,
  heartbeatDetector,
  ConnectivityClient,
} from '@connectivity-js/core';

// 1. Create and start
const client = getConnectivityClient({
  detectors: [
    browserOnlineDetector(),
    heartbeatDetector({ url: '/api/health' }),
  ],
  gracePeriodMs: 3_000,
  onJobError: (error, job) => console.error('Job failed:', job.id, error),
});
client.start();
```

## State subscription

```ts
// Current state
const state = client.getState();
console.log(state.status); // 'online' | 'offline' | 'unknown'

// Subscribe to changes
const unsubscribe = client.subscribe((state, transition) => {
  if (transition?.to === 'offline') showOfflineBanner();
  if (transition?.to === 'online') hideOfflineBanner();
});

unsubscribe();
```

## Register and execute actions

```ts
client.registerAction('save', {
  request: (input) => fetch('/api/save', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then(r => r.json()),
  options: {
    whenOffline: 'queue',
    retry: { maxAttempts: 3, backoffMs: (n) => n * 1_000 },
    dedupeKey: (input) => (input as { id: string }).id,
  },
});

const result = await client.execute('save', { id: '1', data: 'hello' });
if (result.enqueued) {
  console.log('Queued:', result.jobId);
} else {
  console.log('Done:', result.result);
}
```

## Queue management

```ts
const jobs = client.getQueue();
const saveJobs = client.getActionQueue('save');

client.subscribeQueue((jobs) => {
  updateBadge(jobs.filter(j => j.status === 'queued').length);
});

await client.flush();
await client.flush({ onlyActionKey: 'save' });

await client.retry('job_1_1700000000000');
client.cancel('job_1_1700000000000');
```

## React hooks without Provider

All React hooks reference the singleton internally. They work without `ConnectivityProvider`:

```tsx
getConnectivityClient({ detectors: [browserOnlineDetector()] });
getConnectivityClient().start();

function StatusBadge() {
  const { status } = useConnectivity(); // ✅ works
  return <span>{status}</span>;
}
```

Without Provider:
- `defaultOptions` won't apply
- You must call `start()` manually
- You must manage `destroy()` yourself

## Cleanup

```ts
client.destroy();

// Or reset singleton (testing)
ConnectivityClient.resetInstance();
```

## Related

- [ConnectivityClient API](../api/core/connectivity-client.md)
- [Actions](../guide/actions.md)

