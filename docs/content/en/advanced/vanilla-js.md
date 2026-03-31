# Without React

The core of Connectivity is framework-agnostic. Use it directly without React.

## Basic usage

```ts
import {
  ConnectivityClient,
  browserOnlineDetector,
  heartbeatDetector,
} from '@connectivity-js/core';

// 1. Create and start
const client = new ConnectivityClient({
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

client.subscribeQueue(() => {
  const jobs = client.getQueue();
  updateBadge(jobs.filter(j => j.status === 'queued').length);
});

await client.flush();
await client.flush({ onlyActionKey: 'save' });

await client.retry('job_1_1700000000000');
client.cancel('job_1_1700000000000');
```

## Convenience singleton

For simple single-app setups, you can use the singleton shorthand:

```ts
import { getConnectivityClient, browserOnlineDetector } from '@connectivity-js/core';

const client = getConnectivityClient({
  detectors: [browserOnlineDetector()],
});
client.start();
```

> **Note:** The singleton applies only the first caller's options. For SSR, testing, or micro-frontend scenarios, always use `new ConnectivityClient()` instead.

## Cleanup

```ts
client.destroy();

// Or reset singleton (testing)
ConnectivityClient.resetInstance();
```

## Related

- [ConnectivityClient API](../api/core/connectivity-client.md)
- [Actions](../guide/actions.md)

