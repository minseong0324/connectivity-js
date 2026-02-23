# 시작하기

첫 번째 액션을 정의하고 실행하는 방법을 설명합니다. 시작 전에 [설치하기](../installation.md)를 완료해 주세요.

## 첫 번째 Action

서버에 데이터를 저장하는 action을 정의합니다:

```ts
// actions/save.ts
import { actionOptions } from "@connectivity-js/core";

export const saveAction = actionOptions({
  actionKey: "save",
  request: (input: { id: string; data: string }) => api.save(input),
  dedupeKey: (input) => input.id,
});
```

컴포넌트에서 사용합니다:

```tsx
import { useAction } from "@connectivity-js/react";
import { saveAction } from "./actions/save";

function SaveButton({ id, data }: { id: string; data: string }) {
  const { execute, pendingCount } = useAction(saveAction, {
    onSuccess: (result) => toast.success("저장 완료"),
    onEnqueued: (jobId) => toast.info("오프라인 — 큐에 저장됨"),
    onError: (error) => toast.error("저장 실패"),
  });

  return (
    <button onClick={() => execute({ id, data })}>
      저장 {pendingCount > 0 && `(${pendingCount}개 대기 중)`}
    </button>
  );
}
```

### inline으로 정의하기

action을 재사용하지 않는다면 `actionOptions()` 없이 inline으로 넘길 수 있습니다. 타입 추론은 동일하게 동작합니다:

```tsx
const { execute } = useAction({
  actionKey: "save",
  request: (input: { id: string; data: string }) => api.save(input),
  dedupeKey: (input) => input.id, // input 타입 자동 추론
});
```

### 반환값

`execute()`는 discriminated union을 반환합니다:

```ts
const result = await execute({ id: "1", data: "hello" });

if (result.enqueued) {
  // 큐에 저장됨 (offline이거나 같은 대상이 실행 중)
  console.log(result.jobId); // string
  return;
}

// 즉시 실행 완료
console.log(result.result); // TResult — request 반환 타입에서 추론
```

`result.enqueued`로 분기하면 TypeScript가 자동으로 나머지 필드의 타입을 좁힙니다.

## 다음 단계

- [연결 상태 UI](./connectivity-ui.md) — `useConnectivity`, `<Connectivity>`, `useOnConnectivityChange`
- [오프라인 동작](./offline-behavior.md) — `whenOffline`, 실행 흐름, FIFO
- [Deduplication](./deduplication.md) — `dedupeKey`로 중복 요청 합치기
