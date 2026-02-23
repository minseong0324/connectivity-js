# Connectivity

Component that switches between children and fallback based on connectivity.

## Signature

```tsx
function Connectivity(props: ConnectivityProps): ReactElement;
```

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | (required) | UI shown when online |
| `fallback` | `ReactNode` | `null` | Replacement UI when offline |
| `delayMs` | `number` | `0` | Delay before switching to fallback (ms) |

Defaults for `fallback` and `delayMs` come from `ConnectivityProvider`'s `defaultOptions.connectivity`.

## Example

```tsx
<Connectivity fallback={<OfflineBanner />} delayMs={2_000}>
  <App />
</Connectivity>
```

## Behavior

- `unknown` treated as online (SSR-safe)
- `delayMs > 0`: children maintained for the delay period after going offline
- Recovery within delay: fallback never shown

## Related

- [Connectivity UI Guide](../guide/connectivity-ui.md)
- [Default Options](../advanced/default-options.md)

