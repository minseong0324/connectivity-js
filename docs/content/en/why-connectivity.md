# Why Connectivity?

## The Problem

Most web apps assume a stable network. When connectivity drops, things break silently:

- API calls fail with no recovery
- Users lose unsaved work
- Retry logic is scattered across every fetch call
- There is no unified way to show "you're offline"

A typical approach looks like this:

```tsx
function SaveButton({ data }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleSave = async () => {
    if (!isOnline) {
      alert("You are offline");
      return;
    }
    try {
      await api.save(data);
    } catch (err) {
      // Retry? How many times? With backoff?
      // What if user clicks again while retrying?
      // What about deduplication?
    }
  };

  return <button onClick={handleSave}>Save</button>;
}
```

Every component that talks to a server needs to:

1. Track online/offline state manually
2. Implement its own error handling and retry
3. Guard against duplicate submissions
4. Decide what to do when offline (block? queue? ignore?)

This leads to **inconsistent behavior**, **duplicated logic**, and **fragile code**.

## The Solution

Connectivity centralizes all of this into a single layer:

```tsx
function SaveButton({ data }) {
  const { execute, pendingCount } = useAction(
    {
      actionKey: "save",
      request: (input: string) => api.save(input),
      dedupeKey: () => "save",
    },
    {
      onSuccess: () => toast.success("Saved"),
      onEnqueued: () => toast.info("Queued — will send when back online"),
    }
  );

  return (
    <button onClick={() => execute(data)}>
      Save {pendingCount > 0 && `(${pendingCount} pending)`}
    </button>
  );
}
```

No manual online/offline tracking. No retry plumbing. No dedup guards.

## What You Get

| Concern                  | Without Connectivity               | With Connectivity                               |
| ------------------------ | ---------------------------------- | ----------------------------------------------- |
| Online/offline detection | Manual `navigator.onLine` + events | `useConnectivity()` or `<Connectivity>`         |
| Offline behavior         | Block or ignore                    | Configurable: `queue`, `throw`, or `skip`       |
| Queuing                  | Build your own                     | Automatic FIFO queue, flushed on reconnect      |
| Deduplication            | Manual guards                      | Built-in `dedupeKey` — only latest payload sent |
| Retry                    | Per-call try/catch loops           | Declarative retry policy with backoff           |
| Grace period             | None                               | Suppress flicker from brief disconnections      |
| Type safety              | Manual types everywhere            | Full inference from action definitions          |
| Framework coupling       | Tightly coupled                    | Core is framework-agnostic                      |

## Design Principles

### Declarative over imperative

You describe _what_ should happen (queue when offline, dedupe by ID, retry 3 times) — not _how_ to wire it up.

### Convention with escape hatches

Sensible defaults work out of the box. Every behavior is overridable per-action or globally via `defaultOptions`.

### Predictable state transitions

The connectivity state machine has well-defined transitions (`online → offline → online`), with a grace period to prevent rapid flickering.

## Next Steps

- [Installation](./installation.md) — Add Connectivity to your project
- [Connectivity UI](./guide/connectivity-ui.md) — Display online/offline state with `<Connectivity>`
- [Actions](./guide/actions.md) — Build your first action
