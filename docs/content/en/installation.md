# Installation

## Packages

Connectivity is split into two packages:

| Package               | Description                                                  |
| --------------------- | ------------------------------------------------------------ |
| `@connectivity/core`  | Framework-agnostic core: state machine, queue, dedup, retry  |
| `@connectivity/react` | React hooks and components (depends on `@connectivity/core`) |

For React projects, install `@connectivity/react`.

```bash tab="pnpm"
pnpm add @connectivity/react
```

```bash tab="npm"
npm install @connectivity/react
```

```bash tab="yarn"
yarn add @connectivity/react
```

### Peer Dependencies

`@connectivity/react` requires:

- `react` ^18 || ^19

## Provider Setup

Wrap your application root with `ConnectivityProvider`:

```tsx
import {
  ConnectivityProvider,
  browserOnlineDetector,
  heartbeatDetector,
} from "@connectivity/react";

function App() {
  return (
    <ConnectivityProvider
      detectors={[
        browserOnlineDetector(),
        heartbeatDetector({ url: "/api/health" }),
      ]}
      gracePeriodMs={3_000}
      defaultOptions={{
        actions: { whenOffline: "queue" },
      }}
    >
      <YourApp />
    </ConnectivityProvider>
  );
}
```

### `detectors`

Pluggable strategies for determining network status. Combine multiple for reliability:

- **`browserOnlineDetector()`** — Uses `navigator.onLine` + browser events. Fast but cannot detect "LAN connected, no internet" scenarios.
- **`heartbeatDetector({ url })`** — Periodic HEAD requests to verify actual connectivity. Also measures RTT.

Using both together: `browserOnlineDetector` reacts instantly, while `heartbeatDetector` verifies the real connection.

### `gracePeriodMs`

Suppresses state transitions on brief disconnections. If connectivity recovers within this window, the offline transition is ignored entirely. See [Grace Period](./advanced/grace-period.md).

### `defaultOptions`

Global defaults applied to all `useAction` calls and `<Connectivity>` components. See [Default Options](./advanced/default-options.md).

## DevTools (Optional)

For a debugging DevTools panel:

- **React**: `@connectivity/react-devtools`
- **Vanilla JS**: `@connectivity/devtools`

See [DevTools](./advanced/devtools.md) for details.

## Using Without React

If you are not using React, you can use `@connectivity/core` directly:

```bash tab="pnpm"
pnpm add @connectivity/core
```

```bash tab="npm"
npm install @connectivity/core
```

```bash tab="yarn"
yarn add @connectivity/core
```

See [Vanilla JS](./advanced/vanilla-js.md) for usage without React.

## Next Steps

- [Connectivity UI](./guide/connectivity-ui.md) — Display online/offline state with `<Connectivity>`, `useConnectivity`
- [Actions](./guide/actions.md) — Define and execute your first action
