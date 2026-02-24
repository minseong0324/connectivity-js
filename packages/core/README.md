# @connectivity-js/core  &middot; [![MIT License](https://img.shields.io/github/license/minseong0324/connectivity-js?color=blue)](https://github.com/minseong0324/connectivity-js/blob/main/LICENSE) [![NPM Version](https://img.shields.io/npm/v/%40connectivity-js%2Fcore)](https://www.npmjs.com/package/@connectivity-js/core)

<div align="center">
  <img width=340 height=340 src="https://github.com/user-attachments/assets/71b662a7-25ff-423c-9e11-55ef1e16112e" />
</div>

Type-safe, framework-agnostic connectivity detection and offline action queue.

## Installation

```sh
npm install @connectivity-js/core
```

## Usage

```ts
import {
  getConnectivityClient,
  browserOnlineDetector,
  heartbeatDetector,
  actionOptions,
} from '@connectivity-js/core';

// Initialize client
const client = getConnectivityClient({
  detectors: [
    browserOnlineDetector(),
    heartbeatDetector({ url: '/api/health', intervalMs: 10_000 }),
  ],
  gracePeriodMs: 3_000,
});

client.start();

// Subscribe to status changes
client.subscribe(() => {
  const { status, quality } = client.getState();
  console.log(status, quality);
});

// Register and execute an action
const saveAction = actionOptions({
  actionKey: 'save',
  request: (input: { id: string; data: string }) => api.save(input),
  dedupeKey: (input) => input.id,
  whenOffline: 'queue',
});

const result = await client.execute(saveAction.actionKey, { id: '1', data: 'hello' });

if (result.enqueued) {
  console.log('queued:', result.jobId);
} else {
  console.log('executed:', result.result);
}
```

## Documentation

[Full documentation](https://connectivity-js-docs.vercel.app/en)
