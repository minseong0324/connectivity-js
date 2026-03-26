<div align="center">
  <img width=340 height=340 src="https://github.com/user-attachments/assets/71b662a7-25ff-423c-9e11-55ef1e16112e" />
</div>

# connectivity-js

웹 애플리케이션을 위한 선언적이고 type-safe한 offline-first 연결 관리 라이브러리.

| Package | Version | Description |
|---------|---------|-------------|
| [`@connectivity-js/core`](./packages/core) | [![NPM Version](https://img.shields.io/npm/v/%40connectivity-js%2Fcore)](https://www.npmjs.com/package/@connectivity-js/core) | Framework-agnostic core — 어떤 프레임워크나 바닐라 JS에서도 사용 가능 |
| [`@connectivity-js/react`](./packages/react) | [![NPM Version](https://img.shields.io/npm/v/%40connectivity-js%2Freact)](https://www.npmjs.com/package/@connectivity-js/react) | React adapter |
| [`@connectivity-js/devtools`](./packages/devtools) | [![NPM Version](https://img.shields.io/npm/v/%40connectivity-js%2Fdevtools)](https://www.npmjs.com/package/@connectivity-js/devtools) | Framework-agnostic DevTools panel |
| [`@connectivity-js/react-devtools`](./packages/react-devtools) | [![NPM Version](https://img.shields.io/npm/v/%40connectivity-js%2Freact-devtools)](https://www.npmjs.com/package/@connectivity-js/react-devtools) | React DevTools panel |

- **Framework-agnostic**: core는 프레임워크 무관 — 바닐라 JS, Vue, Svelte 등 어디서든 동작
- **Type-safe**: 타입 명시 없이 `TInput`, `TResult`가 완전 추론
- **자동 큐잉**: offline 중 action은 큐에 저장, 연결 복구 시 자동 전송
- **Deduplication**: 빠른 연속 호출을 합쳐서 최신 데이터만 전송
- **Retry**: 실패한 요청을 backoff와 함께 자동 재시도
- **선언적**: React adapter는 `<Connectivity fallback={...}>` 한 줄로 online/offline UI 전환 제공

> **중요**: 큐는 메모리 기반입니다. 대기 중인 액션은 페이지 새로고침이나 탭 닫기 시 유실됩니다. 영구적인 전달을 위해서는 서버 측 멱등성 키를 구현하세요.

## 빠른 시작

### Core (framework-agnostic)

바닐라 JS/TS, Vue, Svelte 등 어떤 환경에서도 사용할 수 있습니다.

```ts
import {
  getConnectivityClient,
  browserOnlineDetector,
  heartbeatDetector,
  actionOptions,
} from '@connectivity-js/core';

// 1. 클라이언트 생성 및 감지 시작
const client = getConnectivityClient({
  detectors: [
    browserOnlineDetector(),
    heartbeatDetector({ url: '/api/health' }),
  ],
  gracePeriodMs: 3_000,
});
client.start();

// 2. 연결 상태 구독
client.subscribe((state, transition) => {
  if (transition?.to === 'offline') {
    document.getElementById('banner')?.classList.add('visible');
  }
  if (transition?.to === 'online') {
    document.getElementById('banner')?.classList.remove('visible');
  }
});

// 3. Action 정의 및 실행
// request는 fetch, ky, axios 등 어떤 HTTP 클라이언트도 사용 가능
const save = actionOptions({
  actionKey: 'save',
  request: (input: { id: string; data: string }) => api.save(input),
  dedupeKey: (input) => input.id,
  whenOffline: 'queue',
});

const result = await client.execute(save, { id: '1', data: 'hello' });
if (result.enqueued) {
  console.log('오프라인 — 큐에 저장됨:', result.jobId);
} else {
  console.log('성공:', result.result);
}

// 4. 정리
client.destroy();
```

### React Adapter

```tsx
import {
  ConnectivityProvider,
  Connectivity,
  browserOnlineDetector,
  useConnectivity,
  useAction,
} from '@connectivity-js/react';

// 1. 앱을 Provider로 감싸기
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

## 기여하기

커뮤니티의 모든 분들의 기여를 환영합니다. [기여 가이드](./CONTRIBUTING.md).


## [공식 문서](https://connectivity-js-docs.vercel.app/ko)

설치 가이드, 사용 예시, API 참고 등은 [공식 문서](https://connectivity-js-docs.vercel.app/ko)에서 확인할 수 있습니다.

## License

See [LICENSE](LICENSE) for more information.

MIT © minseong0324
