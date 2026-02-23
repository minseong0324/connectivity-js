# 커스텀 Detector

`Detector` 인터페이스를 구현하여 어떤 감지 전략이든 추가할 수 있습니다.

## Detector 인터페이스

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

`start()`는:
1. 감지를 시작합니다
2. 상태 변경 시 `listener`를 호출합니다
3. cleanup 함수를 반환합니다

## 예시: WebSocket Detector

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
            if (ws?.readyState === WebSocket.OPEN) {
              ws.send('ping');
            }
          }, 10_000);
        };

        ws.onclose = () => {
          if (pingInterval) clearInterval(pingInterval);
          listener({ status: 'offline', reason: 'websocket' });
          // 5초 후 재연결 시도
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

## 예시: Server-Sent Events (SSE) Detector

```ts
const sseDetector = (url: string) =>
  ({
    start: (listener) => {
      const source = new EventSource(url);

      source.onopen = () => {
        listener({ status: 'online', reason: 'sse' });
      };

      source.onerror = () => {
        listener({ status: 'offline', reason: 'sse' });
      };

      source.addEventListener('connectivity', (event) => {
        const data = JSON.parse(event.data);
        listener({ status: data.status, reason: 'sse' });
      });

      return () => source.close();
    },
  }) satisfies Detector;
```

## 예시: quality 포함 Detector

```ts
const qualityDetector = (probeUrl: string) =>
  ({
    start: (listener) => {
      const probe = async () => {
        const start = performance.now();
        try {
          await fetch(probeUrl, { method: 'HEAD', cache: 'no-store' });
          const rttMs = Math.round(performance.now() - start);
          listener({
            status: 'online',
            reason: 'quality-probe',
            quality: { rttMs },
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

## 여러 Detector 조합

```tsx
<ConnectivityProvider
  detectors={[
    browserOnlineDetector(),       // 즉시 반응
    heartbeatDetector({ url: '/api/health' }), // 서버 도달 확인
    websocketDetector('wss://...'), // 실시간 감지
  ]}
>
  <App />
</ConnectivityProvider>
```

모든 detector의 이벤트가 동일한 `ConnectivityClient`로 전달됩니다. 마지막으로 수신된 이벤트의 `status`가 현재 상태가 됩니다. `gracePeriodMs`가 설정되어 있으면 offline 전환에 유예가 적용됩니다.

## 관련 문서

- [Detectors API](../api/core/detectors.md)
- [액션](../guide/actions.md)

