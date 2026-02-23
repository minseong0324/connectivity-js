# Detectors

connectivity 상태를 감지하는 전략들입니다.

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

`start()`를 호출하면 감지를 시작하고, 반환된 함수로 정리합니다.

## browserOnlineDetector

`navigator.onLine` + `online`/`offline` 이벤트를 감지합니다.

```ts
import { browserOnlineDetector } from '@connectivity-js/core';

const detector = browserOnlineDetector();
```

- 초기화 시 현재 상태를 즉시 emit
- 가벼우므로 기본 detector로 적합
- "LAN 연결, 인터넷 불가" 상태는 감지하지 못함

## heartbeatDetector

주기적으로 서버에 HEAD 요청을 보내 실제 연결을 확인합니다.

```ts
import { heartbeatDetector } from '@connectivity-js/core';

const detector = heartbeatDetector({
  url: '/api/health',
  intervalMs: 10_000,   // 10초 간격 (기본: 30_000)
  timeoutMs: 3_000,     // 타임아웃 (기본: 5_000)
});
```

| 옵션 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `url` | `string` | (필수) | health check 엔드포인트 |
| `intervalMs` | `number` | `30_000` | polling 간격 (ms) |
| `timeoutMs` | `number` | `5_000` | 요청 타임아웃 (ms) |

- 성공 시 RTT와 Network Information API 데이터를 `quality`로 제공
- `browserOnlineDetector`와 함께 사용 권장

## 조합 예시

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

`browserOnlineDetector`가 즉시 반응 → `heartbeatDetector`가 실제 연결 검증.

## 커스텀 Detector

`Detector` 인터페이스를 구현하면 어떤 감지 전략이든 추가할 수 있습니다. 자세한 내용은 [커스텀 Detector](../advanced/custom-detectors.md)를 참고하세요.

## 관련 문서

- [액션](../guide/actions.md)
- [Connection Quality 활용](../guide/connectivity-ui.md)
- [커스텀 Detector](../advanced/custom-detectors.md)

