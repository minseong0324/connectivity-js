# useQueue

job 큐를 조회하고 제어하는 hook입니다.

## 시그니처

```ts
function useQueue(filter?: { actionKey?: string }): {
  jobs: QueuedJob[];
  pendingCount: number;
  retry: (jobId: string) => Promise<void>;
  cancel: (jobId: string) => void;
};
```

## Parameters

| 필드 | 타입 | 설명 |
|---|---|---|
| `filter.actionKey` | `string?` | 특정 action의 job만 조회. 미지정 시 전체 큐 |

`actionKey`를 지정하면 해당 action의 큐 변경 시에만 re-render됩니다 (per-action snapshot 참조 안정성).

## Returns

| 필드 | 타입 | 설명 |
|---|---|---|
| `jobs` | `QueuedJob[]` | 필터링된 job 목록 |
| `pendingCount` | `number` | `queued` + `running` job 수 |
| `retry` | `(jobId) => Promise<void>` | `failed`/`queued` job 재시도 |
| `cancel` | `(jobId) => void` | job 취소 |

## Example

```tsx
const { jobs, pendingCount, retry, cancel } = useQueue({ actionKey: 'save' });

return (
  <ul>
    {jobs.map((job) => (
      <li key={job.id}>
        {job.actionKey} — {job.status}
        {job.status === 'failed' && <button onClick={() => retry(job.id)}>재시도</button>}
        <button onClick={() => cancel(job.id)}>취소</button>
      </li>
    ))}
  </ul>
);
```

## 관련 문서

- [큐 제어](../advanced/flush-control.md)

