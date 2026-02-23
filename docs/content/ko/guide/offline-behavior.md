# 오프라인 동작

action을 실행했을 때 네트워크 상태에 따라 어떻게 동작하는지 설명합니다.

## 기본 동작

`execute()`를 호출하면 네트워크 상태에 따라 자동으로 분기됩니다:

| 상태 | `whenOffline` | 동작 | 반환값 |
|---|---|---|---|
| online | — | 즉시 실행 | `{ enqueued: false, result }` |
| offline | `'queue'` (기본) | 큐에 저장, 연결 복구 시 자동 전송 | `{ enqueued: true, jobId }` |
| offline | `'fail'` | 즉시 에러 throw | — |
| unknown | `'queue'` | 큐에 저장 (보수적) | `{ enqueued: true, jobId }` |
| unknown | `'fail'` | 큐에 저장 (throw 안 함 — 불확실성) | `{ enqueued: true, jobId }` |

> **`unknown` 상태에서 `whenOffline: 'fail'`이 throw하지 않는 이유**
> UI는 낙관적(`unknown` → children 표시)이지만, 데이터는 보수적(`unknown` → 유실 방지를 위해 큐에 저장). 연결 상태가 불확실할 때 throw하면 잠시 후 성공할 수 있었을 사용자 액션이 유실됩니다.

```tsx
// 기본 — offline이면 큐에 저장
const { execute } = useAction({
  actionKey: 'save',
  request: (input) => api.save(input),
});

// 반드시 online이어야 하는 경우
const { execute } = useAction({
  actionKey: 'verify',
  request: (input) => api.verify(input),
  whenOffline: 'fail',
});
```

## 실행 흐름

모든 `execute()` 호출은 **항상 큐에 먼저 job을 생성**합니다 (always-enqueue). 그 후 상황에 따라 분기합니다:

```
execute(actionKey, input)
  │
  ├─ confirmed offline + whenOffline='fail'
  │   → 에러 throw (큐에 넣지 않음)
  │
  ├─ 큐에 job 생성 (dedupe 적용)
  │
  ├─ not confirmed online (offline 또는 unknown)
  │   → { enqueued: true, jobId }
  │
  ├─ 같은 entity가 이미 실행 중 (hasRunningDupe)
  │   → { enqueued: true, jobId }
  │
  └─ confirmed online + 실행 가능
      → 즉시 실행
      ├─ 성공: { enqueued: false, result }
      ├─ 실패 + retry 가능: { enqueued: true, jobId }
      └─ 실패 + retry 불가: throw
```

### hasRunningDupe

같은 `actionKey` + 같은 `dedupeKey`의 job이 이미 `running` 상태이면, 새 요청은 즉시 실행되지 않고 큐에서 대기합니다. 이전 요청이 완료된 후 자동으로 실행됩니다.

이는 **같은 대상에 대한 동시 요청을 방지**하여 서버의 race condition을 예방합니다.

```
execute('save', { id: '1', data: 'v1' })  → running
execute('save', { id: '1', data: 'v2' })  → queued (v1이 running이므로)
execute('save', { id: '2', data: 'v1' })  → running (다른 id이므로 독립)
```

`dedupeKey`가 설정되지 않은 action은 hasRunningDupe가 적용되지 않으며, 모든 요청이 독립적으로 즉시 실행됩니다.

## 자동 Flush

offline 중 큐에 쌓인 job들은 연결이 복구되면 **FIFO 순서**로 자동 전송됩니다.

1. 연결 복구 감지 (detector가 `online` emit)
2. grace period 통과 (설정된 경우)
3. 큐에서 `queued` 상태 + `nextRunAt`이 과거인 job들을 수집
4. action별로 그룹화하여 병렬 실행 (동일 action 내에서는 `flushOption.concurrency`로 제어)

## Job 상태

큐에 있는 각 job은 다음 상태를 거칩니다:

```
queued → running → succeeded → (5초 후 제거)
                 → failed    → (retry 시 queued로 복귀)
                              → (retry 소진 시 유지)
queued → canceled             → (유지)
```

| 상태 | 설명 |
|---|---|
| `queued` | 대기 중. 다음 flush 또는 즉시 실행 대상 |
| `running` | 실행 중 |
| `succeeded` | 성공. 5초 후 자동 제거 |
| `failed` | 실패. `onJobError` 호출됨. retry 소진 시 유지 |
| `canceled` | 사용자가 cancel하거나 stale data로 판정됨 |

## 알아두면 좋은 것

### online 즉시 실행도 큐를 거침

online 상태에서 `execute()`를 호출해도 내부적으로는 job이 큐에 생성됩니다. 이는 `pendingCount`와 `useQueue`가 모든 실행을 추적할 수 있게 하기 위함입니다. 성공 시 job은 `succeeded` 상태로 변경되고 5초 후 자동 제거됩니다.

### unknown 상태

`execute()`에서 `unknown`은 **offline으로 취급**되어 action이 큐잉됩니다. 단, `whenOffline='fail'`이어도 `unknown`에서는 throw하지 않고 큐잉합니다 — throw는 confirmed offline에서만 발생합니다.

이는 `<Connectivity>`와 의도적으로 다릅니다:
- **`<Connectivity>` (UI)**: `unknown`을 online으로 취급 (낙관적 — fallback 깜빡임 방지)
- **`execute()` (Data)**: `unknown`을 offline으로 취급 (보수적 — 데이터 유실 방지)

detector가 이후 `online`을 emit하면 큐잉된 job은 자동으로 flush됩니다.

## 관련 문서

- [Deduplication](./deduplication.md) — `dedupeKey`로 중복 합치기
- [Retry](../advanced/retry.md) — 실패 시 자동 재시도
- [Flush 제어](../advanced/flush-control.md) — concurrency, intervalMs
- [useAction API](../api/react/use-action.md)

