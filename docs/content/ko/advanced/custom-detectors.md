# 커스텀 Detector

> **중요**: Detector가 보고하는 상태는 감지 정책의 결과이며, 절대적인 연결 상태가 아닙니다. **인터넷 연결됨 ≠ 백엔드 접근 가능 ≠ 특정 API 사용 가능**이라는 점을 고려하여 Detector 전략을 설계하세요.

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
3. 감지를 중단하는 cleanup 함수를 반환합니다

## 예시: Polling Detector

가장 단순한 커스텀 detector — 주기적으로 헬스 엔드포인트를 확인합니다.

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

## 예시: WebSocket Detector

자동 재연결을 포함한 실시간 감지.

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
});
```

## 예시: SSE Detector

서버에서 push하는 연결 상태 업데이트를 수신합니다.

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

## 예시: Service Worker Detector

Service Worker로부터 연결 상태 업데이트를 수신합니다.

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

## 예시: Quality 포함 Detector

연결 상태와 함께 RTT를 측정해 리포팅합니다.

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

## 여러 Detector 조합

어떤 조합이든 `ConnectivityClient`에 전달할 수 있습니다. 모든 이벤트는 동일한 클라이언트로 전달되며, 마지막으로 수신된 status가 현재 상태가 됩니다. `gracePeriodMs`가 설정되어 있으면 offline 전환에 유예가 적용됩니다.

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

## 관련 문서

- [Detectors API](../api/core/detectors.md)
- [액션](../guide/actions.md)
