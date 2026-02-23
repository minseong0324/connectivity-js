# Introduction

**Connectivity** is a declarative, type-safe, offline-first connectivity management library for JavaScript and React applications.

## Core Philosophy

Modern web applications need to work reliably regardless of network conditions. Connectivity provides a unified layer that handles online/offline state, action queuing, deduplication, and retry — so you can focus on your product logic instead of plumbing.

## Key Features

- **Declarative** — Switch between online and offline UI with a single component: `<Connectivity fallback={...}>`
- **Type-safe** — `TInput` and `TResult` are fully inferred from your action definitions. No manual type annotations needed.
- **Framework-agnostic** — The core (`@connectivity-js/core`) has zero framework dependencies. The React adapter (`@connectivity-js/react`) is provided out of the box, with more adapters planned.
- **Auto-queue** — Actions executed while offline are automatically queued and flushed in FIFO order when connectivity is restored.
- **Deduplication** — Rapid duplicate calls (e.g. a save button clicked twice) are collapsed so only the latest payload reaches the server.
- **Retry** — Failed requests are automatically retried with configurable backoff strategies.

## Architecture

```
ConnectivityProvider
  └─ ConnectivityClient (singleton)
       ├─ Detectors (browserOnline, heartbeat, custom)
       ├─ ActionObserver (one per useAction hook)
       │    ├─ execute / queue / dedup / retry
       │    └─ callbacks (onSuccess, onEnqueued, onError)
       ├─ useConnectivity (reactive status)
       ├─ useQueue (pending jobs)
       └─ useOnConnectivityChange (transition events)
```

| Layer | Package               | Description                                                      |
| ----- | --------------------- | ---------------------------------------------------------------- |
| Core  | `@connectivity-js/core`  | State machine, queue, dedup, retry. No React dependency.         |
| React | `@connectivity-js/react` | Hooks and components: Provider, useAction, useConnectivity, etc. |

## Quick Example

```tsx
import {
  ConnectivityProvider,
  browserOnlineDetector,
  useAction,
} from "@connectivity-js/react";

function App() {
  return (
    <ConnectivityProvider detectors={[browserOnlineDetector()]}>
      <SaveButton />
    </ConnectivityProvider>
  );
}

function SaveButton() {
  const { execute, pendingCount } = useAction({
    actionKey: "save",
    request: (data: string) => api.save(data),
  });

  return (
    <button onClick={() => execute("hello")}>
      Save {pendingCount > 0 && `(${pendingCount} pending)`}
    </button>
  );
}
```

## Next Steps

- [Why Connectivity?](./why-connectivity.md) — Problems this library solves
- [Installation](./installation.md) — Get up and running
- [Getting Started](./guide/getting-started.md) — Build your first action
