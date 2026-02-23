# connectivity-engine

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
  browserOnlineDetector,
  useConnectivity,
  useAction,
} from 'connectivity-engine-2';

// 1. Provider
function App() {
  return (
    <ConnectivityProvider
      detectors={[browserOnlineDetector()]}
      gracePeriodMs={3_000}
    >
      <MyApp />
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

## Documentation

| | Guide | API Reference | Advanced |
|---|---|---|---|
| EN | [Getting Started](docs/en/guide/getting-started.md) | [useAction](docs/en/api/use-action.md) | [Retry](docs/en/advanced/retry.md) |
| | [Connectivity UI](docs/en/guide/connectivity-ui.md) | [useConnectivity](docs/en/api/use-connectivity.md) | [Flush Control](docs/en/advanced/flush-control.md) |
| | [Offline Behavior](docs/en/guide/offline-behavior.md) | [Connectivity](docs/en/api/connectivity.md) | [Grace Period](docs/en/advanced/grace-period.md) |
| | [Deduplication](docs/en/guide/deduplication.md) | [useOnConnectivityChange](docs/en/api/use-on-connectivity-change.md) | [Custom Detectors](docs/en/advanced/custom-detectors.md) |
| | | [useQueue](docs/en/api/use-queue.md) | [Default Options](docs/en/advanced/default-options.md) |
| | | [ConnectivityClient](docs/en/api/connectivity-client.md) | [Without React](docs/en/advanced/vanilla-js.md) |
| | | [ConnectivityProvider](docs/en/api/connectivity-provider.md) | [Testing](docs/en/advanced/testing.md) |
| | | [actionOptions](docs/en/api/action-options.md) | |
| | | [Detectors](docs/en/api/detectors.md) | |
| | | [Types](docs/en/api/types.md) | |
| KO | [시작하기](docs/ko/guide/getting-started.md) | [useAction](docs/ko/api/use-action.md) | [Retry](docs/ko/advanced/retry.md) |
| | [연결 상태 UI](docs/ko/guide/connectivity-ui.md) | [useConnectivity](docs/ko/api/use-connectivity.md) | [Flush 제어](docs/ko/advanced/flush-control.md) |
| | [오프라인 동작](docs/ko/guide/offline-behavior.md) | [Connectivity](docs/ko/api/connectivity.md) | [Grace Period](docs/ko/advanced/grace-period.md) |
| | [Deduplication](docs/ko/guide/deduplication.md) | [ConnectivityClient](docs/ko/api/connectivity-client.md) | [테스트](docs/ko/advanced/testing.md) |

## Architecture

```
ConnectivityProvider → ConnectivityClient (singleton) → ActionObserver (per hook)
                                                      → useConnectivity / useQueue / ...
```
