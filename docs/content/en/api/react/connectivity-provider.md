# ConnectivityProvider

Provider component that configures `ConnectivityClient` and supplies default options to the React tree.

## Signature

```tsx
function ConnectivityProvider(props: ConnectivityProviderProps): ReactElement;
```

## Props

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `children` | `ReactNode` | ✅ | — | React tree |
| `detectors` | `Detector[]` | ✅* | — | Connectivity detection strategies |
| `client` | `ConnectivityClient` | ✅* | — | Pre-created client instance |
| `gracePeriodMs` | `number` | | `0` | Grace period before offline transition (ms) |
| `onJobError` | `(error, job) => void` | | — | Called on final job failure |
| `defaultOptions` | `ConnectivityProviderOptions` | | — | Global defaults |

> \* Either `detectors` or `client` is required (mutually exclusive). Use `client` when you need full control over the `ConnectivityClient` instance.

### defaultOptions

```ts
interface ConnectivityProviderOptions {
  actions?: Partial<ActionOptions>;
  connectivity?: {
    fallback?: ReactNode;
    delayMs?: number;
  };
};
```

## Behavior

1. First render: `getConnectivityClient(options)` initializes singleton
2. `useEffect`: calls `client.start()`
3. Unmount: calls `client.stop()` (detectors pause, actions/jobs/listeners preserved)
4. `defaultOptions` provided to subtree via React Context

## Example

```tsx
<ConnectivityProvider
  detectors={[browserOnlineDetector(), heartbeatDetector({ url: '/api/health' })]}
  gracePeriodMs={3_000}
  onJobError={(error, job) => Sentry.captureException(error)}
  defaultOptions={{
    actions: {
      whenOffline: 'queue',
      retry: { maxAttempts: 3, backoffMs: (n) => n * 1_000 },
    },
    connectivity: {
      fallback: <GlobalOffline />,
      delayMs: 2_000,
    },
  }}
>
  <App />
</ConnectivityProvider>
```

## Without Provider

All hooks reference the singleton directly. Without Provider:
- `defaultOptions` won't apply
- You must call `start()` manually

See [Without React](../advanced/vanilla-js.md).

## Related

- [Actions](../guide/actions.md)
- [Default Options](../advanced/default-options.md)
- [ConnectivityClient API](../core/connectivity-client)

