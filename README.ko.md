# connectivity-engine

선언적이고 type-safe한 offline-first 연결 관리 라이브러리.

- **선언적**: `<Connectivity fallback={...}>` 한 줄로 online/offline UI 전환
- **Type-safe**: 타입 명시 없이 `TInput`, `TResult`가 완전 추론
- **Framework-agnostic**: core는 프레임워크 무관. React adapter 제공, 다른 프레임워크 추가 예정
- **자동 큐잉**: offline 중 action은 큐에 저장, 연결 복구 시 자동 전송
- **Deduplication**: 빠른 연속 호출을 합쳐서 최신 데이터만 전송
- **Retry**: 실패한 요청을 backoff와 함께 자동 재시도

## 빠른 시작

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

// 2. 연결 상태 표시
function StatusBadge() {
  const { status } = useConnectivity();
  if (status === 'offline') return <Badge>오프라인</Badge>;
  return <Badge>온라인</Badge>;
}

// 3. Action 실행
function SaveButton({ id, data }: { id: string; data: string }) {
  const { execute, pendingCount } = useAction({
    actionKey: 'save',
    request: (input: { id: string; data: string }) => api.save(input),
    dedupeKey: (input) => input.id,
  }, {
    onSuccess: () => toast.success('저장 완료'),
    onEnqueued: () => toast.info('큐에 저장됨'),
  });

  return (
    <button onClick={() => execute({ id, data })}>
      저장 {pendingCount > 0 && `(${pendingCount}개 대기)`}
    </button>
  );
}
```

## 문서

| 가이드 | API 참조 | 고급 기능 |
|---|---|---|
| [시작하기](docs/ko/guide/getting-started.md) | [useAction](docs/ko/api/use-action.md) | [Retry](docs/ko/advanced/retry.md) |
| [연결 상태 UI](docs/ko/guide/connectivity-ui.md) | [useConnectivity](docs/ko/api/use-connectivity.md) | [Flush 제어](docs/ko/advanced/flush-control.md) |
| [오프라인 동작](docs/ko/guide/offline-behavior.md) | [Connectivity](docs/ko/api/connectivity.md) | [Grace Period](docs/ko/advanced/grace-period.md) |
| [Deduplication](docs/ko/guide/deduplication.md) | [useOnConnectivityChange](docs/ko/api/use-on-connectivity-change.md) | [커스텀 Detector](docs/ko/advanced/custom-detectors.md) |
| | [useQueue](docs/ko/api/use-queue.md) | [전역 기본값](docs/ko/advanced/default-options.md) |
| | [ConnectivityClient](docs/ko/api/connectivity-client.md) | [React 없이 사용](docs/ko/advanced/vanilla-js.md) |
| | [ConnectivityProvider](docs/ko/api/connectivity-provider.md) | [테스트](docs/ko/advanced/testing.md) |
| | [actionOptions](docs/ko/api/action-options.md) | |
| | [Detectors](docs/ko/api/detectors.md) | |
| | [Types](docs/ko/api/types.md) | |

## 아키텍처

```
ConnectivityProvider → ConnectivityClient (singleton) → ActionObserver (hook당 1개)
                                                      → useConnectivity / useQueue / ...
```
