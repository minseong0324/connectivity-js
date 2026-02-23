# Retry

실패한 action을 자동으로 재시도하는 방법을 설명합니다.

## 왜 필요한가

네트워크 요청은 일시적 서버 오류(500), 타임아웃, 일시적 연결 끊김 등으로 실패할 수 있습니다. 자동 retry는 이러한 transient failure를 사용자 개입 없이 복구합니다.

## 설정

```ts
const saveAction = actionOptions({
  actionKey: 'save',
  request: (input: { id: string; data: string }) => api.save(input),
  retry: {
    maxAttempts: 3,
    backoffMs: (attempt) => attempt * 1_000, // 1s, 2s, 3s
  },
});
```

### RetryPolicy

| 필드 | 타입 | 설명 |
|---|---|---|
| `maxAttempts` | `number` | 최대 시도 횟수 (첫 실행 포함) |
| `backoffMs` | `(attempt: number) => number` | 시도 횟수에 따른 대기 시간 (ms) |

## 동작

```
1회 시도 → 실패 → backoffMs(1) 대기 → 2회 시도 → 실패 → backoffMs(2) 대기 → 3회 시도 → 실패 → failed
```

1. 실행 실패 시 `maxAttempts`에 도달하지 않았으면 job 상태를 `queued`로 복귀
2. `backoffMs(currentAttempt)` 만큼 대기 후 재시도
3. `maxAttempts`에 도달하면 `failed` 상태로 전환
4. `failed` 시 `onJobError` 콜백이 호출됨

### retry 중 offline 전환

retry 대기 중 offline으로 전환되면 retry 타이머가 만료되어도 실행하지 않습니다. online 복귀 시 flush에서 다시 실행됩니다.

### retry + dedupe

retry 대기 중인 job(queued)에 같은 `dedupeKey`의 새 요청이 들어오면, 기존 job의 `input`이 새 데이터로 교체됩니다. retry 시 최신 데이터가 전송됩니다.

## Backoff 패턴

```ts
// 선형
backoffMs: (attempt) => attempt * 1_000    // 1s, 2s, 3s

// 지수
backoffMs: (attempt) => 2 ** attempt * 500 // 1s, 2s, 4s

// 고정
backoffMs: () => 3_000                     // 항상 3s

// 지터 (서버 부하 분산)
backoffMs: (attempt) => attempt * 1_000 + Math.random() * 500
```

## onJobError

flush 중 job이 최종 실패하면 `onJobError`가 호출됩니다. Sentry 등 에러 모니터링 도구와 연동할 때 사용합니다:

```tsx
<ConnectivityProvider
  detectors={[...]}
  onJobError={(error, job) => {
    Sentry.captureException(error, {
      extra: {
        jobId: job.id,
        actionKey: job.actionKey,
        attempt: job.attempt,
      },
    });
  }}
>
  <App />
</ConnectivityProvider>
```

`onJobError`는 **flush 중** job이 모든 retry를 소진했을 때 호출됩니다. `execute()`에서의 실패는 `useAction`의 `onError` callback으로 처리합니다.

## 관련 문서

- [오프라인 동작](../guide/offline-behavior.md)
- [useAction API](../api/react/use-action.md)
- [ConnectivityClient API](../api/core/connectivity-client.md)

