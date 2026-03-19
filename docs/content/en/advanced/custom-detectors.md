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
3. Returns a cleanup function that stops detection

## Example: Polling Detector

The simplest custom detector — periodically checks a health endpoint.

```ts
const pollDetector: Detector = {
  start: (listener) => {
    const probe = async () => {
      try {
        await fetch('/api/health', { method: 'HEAD', cache: 'no-store' });
        listener({ status: 'online', reason: 'poll' });
      } catch {
        listener({ status: 'offline', reason: 'poll' });
      }
    };

    const id = setInterval(() => void probe(), 10_000);
    void probe();
    return () => clearInterval(id);
  },
};
```

## Example: WebSocket Detector

Real-time detection with automatic reconnection.

```ts
const websocketDetector = (wsUrl: string): Detector => ({
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
});
```

## Example: SSE Detector

Server-Sent Events for server-pushed connectivity updates.

```ts
const sseDetector = (url: string): Detector => ({
  start: (listener) => {
    const source = new EventSource(url);

    source.onopen = () => listener({ status: 'online', reason: 'sse' });
    source.onerror = () => listener({ status: 'offline', reason: 'sse' });

    source.addEventListener('connectivity', (event) => {
      const data = JSON.parse(event.data);
      listener({ status: data.status, reason: 'sse' });
    });

    return () => source.close();
  },
});
```

## Example: Service Worker Detector

Receive connectivity updates from a Service Worker.

```ts
const swDetector: Detector = {
  start: (listener) => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'CONNECTIVITY_UPDATE') {
        listener({ status: e.data.status, reason: 'service-worker' });
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  },
};
```

## Example: Quality-reporting Detector

Report RTT alongside connectivity status.

```ts
const qualityDetector = (probeUrl: string): Detector => ({
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
});
```

## Combining detectors

Pass any combination of detectors to `ConnectivityClient`. All events flow into the same client — the last received status wins. With `gracePeriodMs` set, offline transitions wait through the grace period before committing.

```ts
// Core (framework-agnostic)
const client = getConnectivityClient({
  detectors: [
    browserOnlineDetector(),
    heartbeatDetector({ url: '/api/health' }),
    websocketDetector('wss://example.com/health'),
  ],
});
client.start();
```

```tsx
// React
<ConnectivityProvider
  detectors={[
    browserOnlineDetector(),
    heartbeatDetector({ url: '/api/health' }),
    websocketDetector('wss://example.com/health'),
  ]}
>
  <App />
</ConnectivityProvider>
```

## Related

- [Detectors API](../api/core/detectors.md)
- [Actions](../guide/actions.md)
