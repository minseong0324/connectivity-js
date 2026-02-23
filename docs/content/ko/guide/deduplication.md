# Deduplication

같은 논리적 대상에 대한 중복 요청을 자동으로 합치는 방법을 설명합니다.

## dedupeKey란

`dedupeKey`는 "이 요청이 어떤 대상에 대한 것인지"를 식별하는 함수입니다:

```ts
const saveAction = actionOptions({
  actionKey: 'save',
  request: (input: { id: string; data: string }) => api.save(input),
  dedupeKey: (input) => input.id, // 같은 id = 같은 대상
});
```

같은 `actionKey` + 같은 `dedupeKey`를 가진 job이 큐에 이미 있으면, 새 요청은 기존 job의 `input`을 **교체**합니다 (새 job을 추가하지 않음).

## 시나리오

### 오프라인에서 같은 대상을 여러 번 저장

```
execute({ id: '1', data: 'v1' })  → 큐: [v1]
execute({ id: '1', data: 'v2' })  → 큐: [v2] (v1이 v2로 교체됨)
execute({ id: '1', data: 'v3' })  → 큐: [v3] (v2가 v3로 교체됨)

연결 복구 → 서버에 v3만 전송 (v1, v2는 스킵)
```

큐에는 항상 1개의 job만 유지됩니다. `createdAt`과 `attempt`도 초기화됩니다.

### 온라인에서 빠르게 연속 저장

```
execute({ id: '1', data: 'v1' })  → 즉시 실행 (running)
execute({ id: '1', data: 'v2' })  → 큐에 대기 (v1이 running이므로, hasRunningDupe)
execute({ id: '1', data: 'v3' })  → 큐에서 v2를 v3로 교체

v1 완료 → v3 실행 → 서버에 v1, v3만 도달 (v2 스킵)
```

### 다른 대상은 독립

`dedupeKey`가 다르면 독립적으로 처리됩니다:

```
execute({ id: '1', data: 'a' })  → 큐: [id:1=a]
execute({ id: '2', data: 'b' })  → 큐: [id:1=a, id:2=b]
execute({ id: '1', data: 'c' })  → 큐: [id:1=c, id:2=b] (id:1만 교체)
```

### dedupeKey가 없으면

`dedupeKey`를 설정하지 않으면 모든 요청이 독립적인 job으로 처리됩니다:

```
execute({ msg: 'a' })  → 큐: [a]
execute({ msg: 'b' })  → 큐: [a, b]
execute({ msg: 'a' })  → 큐: [a, b, a] (같은 input이어도 별도 job)
```

로깅, 이벤트 전송처럼 **모든 호출이 의미 있는** action에 적합합니다.

## Stale data 방지

온라인에서 요청이 실패하고 retry가 설정된 경우:

```
execute({ id: '1', data: 'v1' })  → running → 실패 → queued (retry 대기)
execute({ id: '1', data: 'v2' })  → v1이 queued이므로 input을 v2로 교체

retry 타이머 → v2 데이터로 재시도 (v1의 stale data가 아님)
```

만약 v1이 아직 running 중일 때 v2가 도착하면:

```
execute({ id: '1', data: 'v1' })  → running
execute({ id: '1', data: 'v2' })  → 새 job (running dupe이므로)
v1 실패 → v2가 큐에 있음 → v1은 cancel (stale data 전송 방지)
```

## Common Patterns

### 자동 저장

```ts
const autoSaveAction = actionOptions({
  actionKey: 'autoSave',
  request: (input: { docId: string; content: string }) => api.save(input),
  dedupeKey: (input) => input.docId,
});

// 타이핑할 때마다 호출해도 큐에는 최신 content만 유지
onChange((content) => {
  execute({ docId: currentDocId, content });
});
```

### 좋아요 토글

```ts
// dedupeKey 없이 — 매 클릭이 독립 요청
const likeAction = actionOptions({
  actionKey: 'like',
  request: (input: { itemId: string }) => api.toggleLike(input),
});
```

### 여러 필드가 dedupeKey에 포함

```ts
const saveAction = actionOptions({
  actionKey: 'save',
  request: (input: { projectId: string; pageId: string; data: string }) => api.save(input),
  dedupeKey: (input) => `${input.projectId}:${input.pageId}`, // composite key
});
```

## 관련 문서

- [오프라인 동작](./offline-behavior.md) — 실행 흐름, hasRunningDupe
- [Flush 제어](../advanced/flush-control.md) — `dedupeOnFlush` 전략
- [useAction API](../api/react/use-action.md)

