<div align="center">
  <img width=340 height=340 src="https://github.com/user-attachments/assets/71b662a7-25ff-423c-9e11-55ef1e16112e" />
</div>

# connectivity-js

Declarative, type-safe, offline-first solution for connectivity management for web apps.

| Package | Version | Description |
|---------|---------|-------------|
| [`@connectivity-js/core`](./packages/core) | [![NPM Version](https://img.shields.io/npm/v/%40connectivity-js%2Fcore)](https://www.npmjs.com/package/@connectivity-js/core) | Framework-agnostic core — use with any framework or vanilla JS |
| [`@connectivity-js/react`](./packages/react) | [![NPM Version](https://img.shields.io/npm/v/%40connectivity-js%2Freact)](https://www.npmjs.com/package/@connectivity-js/react) | React adapter |
| [`@connectivity-js/devtools`](./packages/devtools) | [![NPM Version](https://img.shields.io/npm/v/%40connectivity-js%2Fdevtools)](https://www.npmjs.com/package/@connectivity-js/devtools) | Framework-agnostic DevTools panel |
| [`@connectivity-js/react-devtools`](./packages/react-devtools) | [![NPM Version](https://img.shields.io/npm/v/%40connectivity-js%2Freact-devtools)](https://www.npmjs.com/package/@connectivity-js/react-devtools) | React DevTools panel |

- **Framework-agnostic**: core has no framework dependency — works with vanilla JS, Vue, Svelte, and more
- **Type-safe**: `TInput` and `TResult` fully inferred — no manual annotation
- **Auto-queue**: offline actions are queued and flushed on reconnect
- **Deduplication**: rapid saves collapsed — only the latest reaches the server
- **Retry**: failed requests retried with configurable backoff
- **Declarative**: React adapter provides `<Connectivity fallback={...}>` for online/offline UI switching

> **Important**: The queue is memory-backed. Pending actions are lost on page refresh or tab close. For durable delivery, implement server-side idempotency keys.

## Quick Start

### Core (framework-agnostic)

Works with vanilla JS/TS, Vue, Svelte, or any other environment.

```ts
import {
  getConnectivityClient,
  browserOnlineDetector,
  heartbeatDetector,
  actionOptions,
} from '@connectivity-js/core';

// 1. Create client and start detection
const client = getConnectivityClient({
  detectors: [
    browserOnlineDetector(),
    heartbeatDetector({ url: '/api/health' }),
  ],
  gracePeriodMs: 3_000,
});
client.start();

// 2. Subscribe to connectivity state
client.subscribe((state, transition) => {
  if (transition?.to === 'offline') {
    document.getElementById('banner')?.classList.add('visible');
  }
  if (transition?.to === 'online') {
    document.getElementById('banner')?.classList.remove('visible');
  }
});

// 3. Define and execute actions
// request accepts any HTTP client — fetch, ky, axios, etc.
const save = actionOptions({
  actionKey: 'save',
  request: (input: { id: string; data: string }) => api.save(input),
  dedupeKey: (input) => input.id,
  whenOffline: 'queue',
});

const result = await client.execute(save, { id: '1', data: 'hello' });
if (result.enqueued) {
  console.log('Offline — queued:', result.jobId);
} else {
  console.log('Succeeded:', result.result);
}

// 4. Clean up
client.destroy();
```

### React Adapter

```tsx
import {
  ConnectivityProvider,
  Connectivity,
  browserOnlineDetector,
  useConnectivity,
  useAction,
} from '@connectivity-js/react';

// 1. Wrap your app
function App() {
  return (
    <ConnectivityProvider
      detectors={[browserOnlineDetector()]}
      gracePeriodMs={3_000}
    >
      <Connectivity fallback={<div>You're offline</div>} delayMs={3_000}>
        <MyApp />
      </Connectivity>
    </ConnectivityProvider>
  );
}

// 2. Display status
function StatusBadge() {
  const { status } = useConnectivity();
  if (status === 'offline') return <Badge>Offline</Badge>;
  return <Badge>Online</Badge>;
}

// 3. Execute actions
function SaveButton({ id, data }: { id: string; data: string }) {
  const { execute, pendingCount } = useAction({
    actionKey: 'save',
    request: (input: { id: string; data: string }) => api.save(input),
    dedupeKey: (input) => input.id,
  }, {
    onSuccess: () => toast.success('Saved'),
    onEnqueued: () => toast.info('Queued'),
  });

  return (
    <button onClick={() => execute({ id, data })}>
      Save {pendingCount > 0 && `(${pendingCount})`}
    </button>
  );
}
```

## Contributing

We welcome contributions from everyone in the community. Read the detailed [contribution guide](./CONTRIBUTING.md).


## [Check out the docs](https://connectivity-js-docs.vercel.app/en)

[Check out the docs](https://connectivity-js-docs.vercel.app/en) for installation guides, usage examples, API reference, and more.

## License

See [LICENSE](LICENSE) for more information.

MIT © minseong0324
