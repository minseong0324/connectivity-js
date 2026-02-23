# Detectors

Pluggable strategies for detecting connectivity status.

## Detector interface

```ts
interface Detector {
  start: (listener: (event: DetectorEvent) => void) => () => void;
};

interface DetectorEvent {
  status: 'online' | 'offline' | 'unknown';
  reason: string;
  quality?: ConnectionQuality;
};
```

Call `start()` to begin detection, invoke the returned function to clean up.

## browserOnlineDetector

Listens to `navigator.onLine` + `online`/`offline` events.

```ts
import { browserOnlineDetector } from '@connectivity/core';

const detector = browserOnlineDetector();
```

- Emits current state immediately on initialization
- Lightweight — good default detector
- Cannot detect "LAN connected, no internet" scenarios

## heartbeatDetector

Periodic HEAD requests to verify actual connectivity.

```ts
import { heartbeatDetector } from '@connectivity/core';

const detector = heartbeatDetector({
  url: '/api/health',
  intervalMs: 10_000,   // 10s (default: 30_000)
  timeoutMs: 3_000,     // timeout (default: 5_000)
});
```

| Option | Type | Default | Description |
|---|---|---|---|
| `url` | `string` | (required) | Health check endpoint |
| `intervalMs` | `number` | `30_000` | Polling interval (ms) |
| `timeoutMs` | `number` | `5_000` | Request timeout (ms) |

- On success: provides RTT and Network Information API data as `quality`
- Recommended to use alongside `browserOnlineDetector`

## Combined usage

```tsx
<ConnectivityProvider
  detectors={[
    browserOnlineDetector(),
    heartbeatDetector({ url: '/api/health', intervalMs: 15_000 }),
  ]}
>
  <App />
</ConnectivityProvider>
```

`browserOnlineDetector` reacts instantly, `heartbeatDetector` verifies the real connection.

## Custom Detectors

Implement the `Detector` interface for any detection strategy. See [Custom Detectors](../advanced/custom-detectors.md).

## Related

- [Getting Started](../guide/getting-started.md)
- [Custom Detectors](../advanced/custom-detectors.md)

