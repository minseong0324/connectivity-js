# Grace Period

Suppressing offline transitions caused by brief disconnections.

## Why

Wi-Fi switching, tunnel traversal, and mobile handoffs commonly cause 1–2 second disconnections followed by immediate recovery. Showing offline UI for these degrades the experience.

## Configuration

```tsx
<ConnectivityProvider
  detectors={[browserOnlineDetector()]}
  gracePeriodMs={3_000} // 3 second grace
>
  <App />
</ConnectivityProvider>
```

## Behavior

```
detector: offline event
  │
  ├─ gracePeriodMs timer starts (3s)
  │
  ├─ online event within 3s
  │   → timer canceled. No state change. No UI change.
  │
  └─ exceeds 3s
      → state transitions to offline. Listeners notified.
```

### Notes

- `gracePeriodMs` applies only to **offline transitions**, not online recovery
- online → offline → (grace) → online: state never becomes offline
- `gracePeriodMs: 0` disables the grace period (default)

### vs Connectivity component's delayMs

| | `gracePeriodMs` | `delayMs` |
|---|---|---|
| Scope | `ConnectivityClient` (global) | `<Connectivity>` (per-component) |
| Affects | All subscribers, hooks, queue flush | Only that component's children/fallback switch |
| Stacking | Yes — they operate independently |

```
gracePeriodMs=3s, delayMs=2s:

t=0s  detector: offline
t=3s  grace period expires → state: offline
t=5s  delayMs expires → UI: fallback shown
```

## Related

- [Connectivity UI](../guide/connectivity-ui.md)
- [ConnectivityProvider API](../api/react/connectivity-provider.md)

