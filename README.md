# connectivity-js

<div align="center">
  <img src="https://raw.githubusercontent.com/minseong0324/connectivity-js/main/docs/public/img/og-webp.webp" alt="connectivity-js" width="600" />
</div>

Declarative, type-safe, offline-first solution for connectivity management for web apps.

| Package | Version | Description |
|---------|---------|-------------|
| [`@connectivity-js/core`](./packages/core) | [![NPM Version](https://img.shields.io/npm/v/%40connectivity-js%2Fcore)](https://www.npmjs.com/package/@connectivity-js/core) | Framework-agnostic core |
| [`@connectivity-js/react`](./packages/react) | [![NPM Version](https://img.shields.io/npm/v/%40connectivity-js%2Freact)](https://www.npmjs.com/package/@connectivity-js/react) | React adapter |
| [`@connectivity-js/devtools`](./packages/devtools) | [![NPM Version](https://img.shields.io/npm/v/%40connectivity-js%2Fdevtools)](https://www.npmjs.com/package/@connectivity-js/devtools) | Framework-agnostic DevTools panel |
| [`@connectivity-js/react-devtools`](./packages/react-devtools) | [![NPM Version](https://img.shields.io/npm/v/%40connectivity-js%2Freact-devtools)](https://www.npmjs.com/package/@connectivity-js/react-devtools) | React DevTools panel |

- **Declarative**: `<Connectivity fallback={...}>` for online/offline UI switching
- **Type-safe**: `TInput` and `TResult` fully inferred — no manual annotation
- **Framework-agnostic**: core has no framework dependency. React adapter included, more planned
- **Auto-queue**: offline actions are queued and flushed on reconnect
- **Deduplication**: rapid saves collapsed — only the latest reaches the server
- **Retry**: failed requests retried with configurable backoff

## Quick Start

```tsx
import {
  ConnectivityProvider,
  Connectivity,
  browserOnlineDetector,
  useConnectivity,
  useAction,
} from '@connectivity-js/react';

// 1. Provider
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

We welcome contribution from everyone in the community. Read for detailed [contribution guide](https://github.com/offlegacy/event-tracker/blob/main/CONTRIBUTING.md).


## [Check out the docs](https://connectivity-js-docs.vercel.app/en)

[Check out the docs](https://connectivity-js-docs.vercel.app/en) for installation guides, usage examples, API reference, and more.

## License

See [LICENSE](LICENSE) for more information.

MIT © minseong0324