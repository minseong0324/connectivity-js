# React 없이 사용

Connectivity의 core는 framework-agnostic합니다. React 없이 직접 사용할 수 있습니다.

## 기본 사용

```ts
import {
  getConnectivityClient,
  browserOnlineDetector,
  heartbeatDetector,
  ConnectivityClient,
} from '@connectivity/core';

// 1. 인스턴스 생성 및 시작
const client = getConnectivityClient({
  detectors: [
    browserOnlineDetector(),
    heartbeatDetector({ url: '/api/health' }),
  ],
  gracePeriodMs: 3_000,
  onJobError: (error, job) => console.error('Job failed:', job.id, error),
});
client.start();
```

## 상태 구독

```ts
// 현재 상태 조회
const state = client.getState();
console.log(state.status); // 'online' | 'offline' | 'unknown'

// 상태 변경 구독
const unsubscribe = client.subscribe((state, transition) => {
  if (transition?.to === 'offline') {
    showOfflineBanner();
  }
  if (transition?.to === 'online') {
    hideOfflineBanner();
  }
});

// 구독 해제
unsubscribe();
```

## Action 등록 및 실행

```ts
// action 등록
client.registerAction('save', {
  request: (input) => fetch('/api/save', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then(r => r.json()),
  options: {
    whenOffline: 'queue',
    retry: { maxAttempts: 3, backoffMs: (n) => n * 1_000 },
    dedupeKey: (input) => (input as { id: string }).id,
  },
});

// action 실행
const result = await client.execute('save', { id: '1', data: 'hello' });
if (result.enqueued) {
  console.log('큐에 저장됨:', result.jobId);
} else {
  console.log('즉시 완료:', result.result);
}
```

## 큐 관리

```ts
// 전체 큐 조회
const jobs = client.getQueue();

// 특정 action의 큐만 조회
const saveJobs = client.getActionQueue('save');

// 큐 변경 구독
client.subscribeQueue((jobs) => {
  const pending = jobs.filter(j => j.status === 'queued');
  updateBadge(pending.length);
});

// 수동 flush
await client.flush();
await client.flush({ onlyActionKey: 'save' });

// job 재시도 / 취소
await client.retry('job_1_1700000000000');
client.cancel('job_1_1700000000000');
```

## Provider 없이 React hook 사용

모든 React hook은 내부적으로 singleton을 직접 참조합니다. `ConnectivityProvider` 없이도 동작합니다:

```tsx
// Provider 없이 직접 초기화
getConnectivityClient({
  detectors: [browserOnlineDetector()],
});
getConnectivityClient().start();

// hook 정상 동작
function StatusBadge() {
  const { status } = useConnectivity(); // ✅ 동작
  return <span>{status}</span>;
}
```

단, Provider가 없으면:
- `defaultOptions`가 적용되지 않습니다
- `start()`를 직접 호출해야 합니다
- `destroy()` 호출도 직접 관리해야 합니다

## 정리

```ts
// 인스턴스 파괴
client.destroy();

// 또는 singleton 초기화 (테스트용)
ConnectivityClient.resetInstance();
```

## 관련 문서

- [ConnectivityClient API](../api/core/connectivity-client.md)
- [액션](../guide/actions.md)

