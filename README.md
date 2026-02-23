# connectivity-js

Declarative, type-safe, offline-first connectivity management.

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

## [Check out the docs](https://connectivity-js-docs.vercel.app/en)

[Check out the docs](https://connectivity-js-docs.vercel.app/en) for installation guides, usage examples, API reference, and more.

## License

See [LICENSE](LICENSE) for more information.

MIT © minseong0324