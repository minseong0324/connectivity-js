# useQueue

Hook for accessing and controlling the job queue.

## Signature

```ts
function useQueue(filter?: { actionKey?: string }): {
  jobs: QueuedJob[];
  pendingCount: number;
  retry: (jobId: string) => Promise<void>;
  cancel: (jobId: string) => void;
};
```

## Parameters

| Field | Type | Description |
|---|---|---|
| `filter.actionKey` | `string?` | Only show jobs for this action. Omit for entire queue |

When `actionKey` is set, re-renders only when that action's queue changes (per-action snapshot stability).

## Returns

| Field | Type | Description |
|---|---|---|
| `jobs` | `QueuedJob[]` | Filtered job list |
| `pendingCount` | `number` | `queued` + `running` count |
| `retry` | `(jobId) => Promise<void>` | Retry a `failed`/`queued` job |
| `cancel` | `(jobId) => void` | Cancel a job |

## Example

```tsx
const { jobs, pendingCount, retry, cancel } = useQueue({ actionKey: 'save' });

return (
  <ul>
    {jobs.map((job) => (
      <li key={job.id}>
        {job.actionKey} — {job.status}
        {job.status === 'failed' && <button onClick={() => retry(job.id)}>Retry</button>}
        <button onClick={() => cancel(job.id)}>Cancel</button>
      </li>
    ))}
  </ul>
);
```

## Related

- [Queue Control](../advanced/flush-control.md)

