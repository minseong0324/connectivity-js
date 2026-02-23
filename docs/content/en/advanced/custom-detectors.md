# Custom Detectors

Implement the `Detector` interface to add any detection strategy.

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

`start()`:
1. Begins detection
2. Calls `listener` on state changes
3. Returns a cleanup function

## Example: WebSocket Detector

```ts
const websocketDetector = (wsUrl: string) =>
  ({
    start: (listener) => {
      let ws: WebSocket | null = null;
      let pingInterval: ReturnType<typeof setInterval> | null = null;

      const connect = () => {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          listener({ status: 'online', reason: 'websocket' });
          pingInterval = setInterval(() => {
            if (ws?.readyState === WebSocket.OPEN) ws.send('ping');
          }, 10_000);
        };

        ws.onclose = () => {
          if (pingInterval) clearInterval(pingInterval);
          listener({ status: 'offline', reason: 'websocket' });
          setTimeout(connect, 5_000);
        };
      };

      connect();
      return () => {
        if (pingInterval) clearInterval(pingInterval);
        ws?.close();
      };
    },
  }) satisfies Detector;
```

## Example: SSE Detector

```ts
const sseDetector = (url: string) =>
  ({
    start: (listener) => {
      const source = new EventSource(url);
      source.onopen = () => listener({ status: 'online', reason: 'sse' });
      source.onerror = () => listener({ status: 'offline', reason: 'sse' });
      return () => source.close();
    },
  }) satisfies Detector;
```

## Example: quality-reporting Detector

```ts
const qualityDetector = (probeUrl: string) =>
  ({
    start: (listener) => {
      const probe = async () => {
        const start = performance.now();
        try {
          await fetch(probeUrl, { method: 'HEAD', cache: 'no-store' });
          listener({
            status: 'online',
            reason: 'quality-probe',
            quality: { rttMs: Math.round(performance.now() - start) },
          });
        } catch {
          listener({ status: 'offline', reason: 'quality-probe' });
        }
      };

      const id = setInterval(() => void probe(), 15_000);
      void probe();
      return () => clearInterval(id);
    },
  }) satisfies Detector;
```

## Combining detectors

```tsx
<ConnectivityProvider
  detectors={[
    browserOnlineDetector(),
    heartbeatDetector({ url: '/api/health' }),
    websocketDetector('wss://...'),
  ]}
>
  <App />
</ConnectivityProvider>
```

All detector events flow into the same `ConnectivityClient`. The last received `status` becomes the current state. If `gracePeriodMs` is set, offline transitions go through the grace period.

## Related

- [Detectors API](../api/core/detectors.md)
- [Getting Started](../guide/getting-started.md)

