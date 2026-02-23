# connectivity-js

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
      <Connectivity fallback={<div>오프라인입니다</div>} delayMs={3_000}>
        <MyApp />
      </Connectivity>
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

## [공식 문서](https://connectivity-js-docs.vercel.app/ko)

설치 가이드, 사용 예시, API 참고 등은 [공식 문서](https://connectivity-js-docs.vercel.app/ko)에서 확인할 수 있습니다.

## License

See [LICENSE](LICENSE) for more information.

MIT © minseong0324