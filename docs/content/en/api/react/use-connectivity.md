# useConnectivity

Hook that subscribes to current connectivity state.

## Signature

```ts
function useConnectivity(): ConnectivityState;
```

No parameters. Works without `ConnectivityProvider`.

## Returns

```ts
interface ConnectivityState {
  status: 'online' | 'offline' | 'unknown';
  since: number;
  reason?: string;
  quality: {
    rttMs?: number;
    effectiveType?: string;
    downlink?: number;
  };
};
```

Returns a new reference only when state actually changes.

## Example

```tsx
function StatusBadge() {
  const { status, quality } = useConnectivity();

  if (status === 'offline') return <Badge color="red">Offline</Badge>;
  if (quality.rttMs !== undefined && quality.rttMs > 500) {
    return <Badge color="yellow">Slow</Badge>;
  }
  return <Badge color="green">Online</Badge>;
}
```

## SSR

Returns `{ status: 'unknown', since: 0, quality: {} }` during server rendering.

## Related

- [Connectivity UI Guide](../guide/connectivity-ui.md)
- [Connectivity API](./connectivity.md)

