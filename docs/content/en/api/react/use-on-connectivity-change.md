# useOnConnectivityChange

Hook that fires callbacks on connectivity state transitions.

## Signature

```ts
function useOnConnectivityChange(handlers: ConnectivityChangeHandlers): void;

type ConnectivityChangeHandlers = Partial<
  Record<'online' | 'offline' | 'unknown', (transition: ConnectivityTransition) => void>
>;

interface ConnectivityTransition {
  from: ConnectivityStatus;
  to: ConnectivityStatus;
  duration: number; // ms the previous state lasted
};
```

## Parameters

| Field | Type | Description |
|---|---|---|
| `online` | `(transition) => void` | Called on transition to online |
| `offline` | `(transition) => void` | Called on transition to offline |
| `unknown` | `(transition) => void` | Called on transition to unknown |

All handlers are optional. Inline functions are safe — no re-subscription (ref pattern).

## Example

```tsx
useOnConnectivityChange({
  offline: () => toast.warning('Connection lost'),
  online: (transition) => {
    if (transition.duration > 60_000) {
      dialog.open(ReconnectedNotice);
      return;
    }
    toast.success('Back online');
  },
});
```

Not called on initial mount — only on actual state **transitions**.

## Related

- [Connectivity UI Guide](../guide/connectivity-ui.md)

