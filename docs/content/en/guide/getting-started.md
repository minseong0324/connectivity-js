# Getting Started

This guide walks you through defining and executing your first action. Make sure you have completed [Installation](../installation.md) before proceeding.

## Your First Action

Define an action that saves data to a server:

```ts
// actions/save.ts
import { actionOptions } from "@connectivity/core";

export const saveAction = actionOptions({
  actionKey: "save",
  request: (input: { id: string; data: string }) => api.save(input),
  dedupeKey: (input) => input.id,
});
```

Use it in a component:

```tsx
import { useAction } from "@connectivity/react";
import { saveAction } from "./actions/save";

function SaveButton({ id, data }: { id: string; data: string }) {
  const { execute, pendingCount } = useAction(saveAction, {
    onSuccess: (result) => toast.success("Saved"),
    onEnqueued: (jobId) => toast.info("Offline — queued"),
    onError: (error) => toast.error("Failed"),
  });

  return (
    <button onClick={() => execute({ id, data })}>
      Save {pendingCount > 0 && `(${pendingCount} pending)`}
    </button>
  );
}
```

### Inline definition

If an action isn't reused, skip `actionOptions()` and pass config inline. Type inference works the same:

```tsx
const { execute } = useAction({
  actionKey: "save",
  request: (input: { id: string; data: string }) => api.save(input),
  dedupeKey: (input) => input.id, // input type auto-inferred
});
```

### Return value

`execute()` returns a discriminated union:

```ts
const result = await execute({ id: "1", data: "hello" });

if (result.enqueued) {
  // Queued (offline or same resource running)
  console.log(result.jobId); // string
  return;
}

// Immediate execution completed
console.log(result.result); // TResult — inferred from request return type
```

Branching on `result.enqueued` automatically narrows the remaining fields.

## Next steps

- [Connectivity UI](./connectivity-ui.md) — `useConnectivity`, `<Connectivity>`, `useOnConnectivityChange`
- [Offline Behavior](./offline-behavior.md) — `whenOffline`, execution flow, FIFO
- [Deduplication](./deduplication.md) — collapsing duplicate requests with `dedupeKey`
