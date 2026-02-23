# Connectivity UI

How to display the current network status to users.

## useConnectivity

Subscribes to connectivity state. Re-renders only when state changes.

```tsx
import { useConnectivity } from '@connectivity/react';

function StatusBadge() {
  const { status, quality } = useConnectivity();

  if (status === 'offline') return <Badge color="red">Offline</Badge>;
  if (quality.rttMs !== undefined && quality.rttMs > 500) {
    return <Badge color="yellow">Slow</Badge>;
  }
  return <Badge color="green">Online</Badge>;
}
```

Returns:

| Field | Type | Description |
|---|---|---|
| `status` | `'online' \| 'offline' \| 'unknown'` | Current state. Narrows automatically in conditionals |
| `since` | `number` | `Date.now()` when current state started |
| `reason` | `string?` | Cause of last transition (e.g. `'navigator'`, `'heartbeat'`) |
| `quality` | `ConnectionQuality` | RTT, effectiveType, downlink |

### Common Patterns

**Status bar indicator:**

```tsx
function ConnectionIndicator() {
  const { status } = useConnectivity();

  return (
    <div className="status-bar">
      <span className={`dot dot--${status}`} />
      {status === 'offline' && 'Offline'}
      {status === 'online' && 'Online'}
      {status === 'unknown' && 'Checking...'}
    </div>
  );
}
```

**Slow connection detection:**

```tsx
function SlowConnectionWarning() {
  const { status, quality } = useConnectivity();

  if (status !== 'online') return null;
  if (quality.rttMs === undefined || quality.rttMs <= 1_000) return null;

  return <Banner>Connection is slow. Saving may take longer.</Banner>;
}
```

**Offline duration:**

```tsx
function OfflineDuration() {
  const { status, since } = useConnectivity();

  if (status !== 'offline') return null;

  const elapsed = Math.round((Date.now() - since) / 1_000);
  return <span>Offline for {elapsed}s</span>;
}
```

## Connectivity

Declarative children/fallback switching based on connectivity.

```tsx
import { Connectivity } from '@connectivity/react';

<Connectivity fallback={<OfflineScreen />}>
  <App />
</Connectivity>
```

Renders `children` when online, `fallback` when offline. `unknown` is treated as online (SSR-safe).

### `delayMs`

Delays the UI switch to prevent flicker on brief disconnections:

```tsx
<Connectivity fallback={<OfflineScreen />} delayMs={2_000}>
  <App />
</Connectivity>
```

- Offline event → children maintained for 2 seconds
- Recovery within 2s → fallback never shown
- Exceeds 2s → switch to fallback

### Defaults

Set global fallback/delayMs via `ConnectivityProvider`:

```tsx
<ConnectivityProvider
  detectors={[...]}
  defaultOptions={{
    connectivity: {
      fallback: <GlobalOfflineScreen />,
      delayMs: 2_000,
    },
  }}
>
  <Connectivity><App /></Connectivity>
  <Connectivity fallback={<Custom />} delayMs={0}><Critical /></Connectivity>
</ConnectivityProvider>
```

### Common Patterns

**Full-page offline screen:**

```tsx
function RootLayout({ children }) {
  return (
    <Connectivity fallback={<FullScreenOffline />} delayMs={3_000}>
      <Header />
      <Main>{children}</Main>
    </Connectivity>
  );
}
```

**Section-level offline:**

```tsx
function Dashboard() {
  return (
    <div>
      <StaticContent />
      <Connectivity fallback={<p>This section requires connectivity.</p>}>
        <LiveData />
      </Connectivity>
    </div>
  );
}
```

## useOnConnectivityChange

Fires callbacks on state **transitions**. Not called on initial mount.

```tsx
import { useOnConnectivityChange } from '@connectivity/react';

useOnConnectivityChange({
  offline: () => toast.warning('Connection lost'),
  online: (transition) => {
    toast.success('Back online');
  },
});
```

`transition` object:

| Field | Type | Description |
|---|---|---|
| `from` | `ConnectivityStatus` | Previous state |
| `to` | `ConnectivityStatus` | Current state |
| `duration` | `number` | How long the previous state lasted (ms) |

### Inline callbacks are safe

Callbacks are stored in a ref internally, so inline functions don't cause re-subscription:

```tsx
useOnConnectivityChange({
  offline: () => toast.warning('Lost'),
  online: () => toast.success('Restored'),
});
```

### Common Patterns

**Long-offline dialog:**

```tsx
useOnConnectivityChange({
  online: (transition) => {
    if (transition.duration > 60_000) {
      overlay.open(({ close }) => (
        <ReconnectedDialog duration={transition.duration} onClose={close} />
      ));
      return;
    }
    toast.success('Reconnected');
  },
});
```

**Auto-save on offline entry:**

```tsx
useOnConnectivityChange({
  offline: () => {
    saveToLocalStorage(getCurrentState());
  },
});
```

**Analytics:**

```tsx
useOnConnectivityChange({
  online: (t) => analytics.track('connectivity_restored', { duration: t.duration }),
  offline: (t) => analytics.track('connectivity_lost', { from: t.from }),
});
```

## Good to know

### Works without Provider

All hooks reference the singleton directly. Without Provider, `defaultOptions` won't apply, but hooks work fine.

### SSR-safe

All hooks return `'unknown'` during SSR. `<Connectivity>` treats `unknown` as online — no hydration mismatch.

### Reference stability

The `ConnectivityState` object returned by `useConnectivity()` is a new reference only when state actually changes.

## Next steps

- [Actions](./actions.md) — Define and execute your first action with `useAction`

## Related

- [useConnectivity API](../api/react/use-connectivity.md)
- [Connectivity API](../api/react/connectivity.md)
- [useOnConnectivityChange API](../api/react/use-on-connectivity-change.md)
- [Grace Period](../advanced/grace-period.md)

