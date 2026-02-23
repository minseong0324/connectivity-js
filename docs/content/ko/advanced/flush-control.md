# Flush 제어

online 복귀 시 큐를 flush하는 방식을 세밀하게 제어하는 방법을 설명합니다.

## 왜 필요한가

offline 동안 수십~수백 개의 job이 큐에 쌓일 수 있습니다. 연결 복구 시 모든 job을 동시에 전송하면 서버에 과도한 부하를 줄 수 있습니다. `flushOption`으로 동시 실행 수와 batch 간격을 제어합니다.

## flushOption

```ts
const saveAction = actionOptions({
  actionKey: 'save',
  request: (input) => api.save(input),
  flushOption: {
    concurrency: 3,      // 동시에 최대 3개 실행
    intervalMs: 500,      // 각 batch 사이 500ms 대기
  },
});
```

### 필드

| 필드 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `concurrency` | `number` | `Infinity` | 동시에 실행할 최대 job 수 |
| `intervalMs` | `number` | `0` | 각 batch 실행 후 대기 시간 (ms) |

### 동작

```
큐: [A, B, C, D, E]  (concurrency: 2, intervalMs: 500)

Batch 1: [A, B] 실행 → 500ms 대기
Batch 2: [C, D] 실행 → 500ms 대기
Batch 3: [E] 실행 → 완료
```

- 같은 action 내에서 batch 단위로 실행됩니다
- 서로 다른 action은 병렬로 실행됩니다
- batch 내 job들은 `Promise.allSettled`로 병렬 실행됩니다

### 전역 기본값과 per-action 설정

`ConnectivityProvider`에서 전역 기본값을 설정하고, per-action으로 override할 수 있습니다:

```tsx
<ConnectivityProvider
  detectors={[...]}
  defaultOptions={{
    actions: {
      flushOption: { concurrency: 5 }, // 전역: 최대 5개 동시
    },
  }}
>
  <App />
</ConnectivityProvider>
```

per-action에서 설정한 값이 전역 기본값을 override합니다. 미설정 시 전역 기본값이 적용됩니다. `concurrency`와 `intervalMs` 모두 동일한 규칙입니다.

## dedupeOnFlush

flush 시점에 같은 `dedupeKey`를 가진 job이 여러 개 있을 때의 dedupe 전략입니다.

```ts
const saveAction = actionOptions({
  actionKey: 'save',
  request: (input) => api.save(input),
  dedupeKey: (input) => input.id,
  dedupeOnFlush: 'keep-last',
});
```

| 전략 | 설명 |
|---|---|
| `'keep-first'` | 가장 먼저 enqueue된 job만 유지, 나머지 cancel |
| `'keep-last'` | 가장 나중에 enqueue된 job만 유지, 나머지 cancel |

### 언제 사용하나요?

일반적인 dedupe(`dedupeKey`)는 enqueue 시점에 동작합니다. 하지만 retry 실패로 같은 key의 job이 여러 개 남아 있을 수 있습니다. `dedupeOnFlush`는 flush 직전에 한 번 더 정리합니다.

### 예시

```
큐: [save:1 (v1), save:1 (v3)]  ← retry 실패 등으로 같은 key가 2개

dedupeOnFlush: 'keep-last'
→ save:1 (v1) cancel → save:1 (v3)만 실행

dedupeOnFlush: 'keep-first'
→ save:1 (v3) cancel → save:1 (v1)만 실행
```

## 관련 문서

- [오프라인 동작](../guide/offline-behavior.md)
- [Deduplication](../guide/deduplication.md)
- [전역 기본값](./default-options.md)

