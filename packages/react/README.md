<div align="center">
  <img width=340 height=340 src="https://github.com/user-attachments/assets/71b662a7-25ff-423c-9e11-55ef1e16112e" />
</div>

# @connectivity-js/react &middot; [![MIT License](https://img.shields.io/github/license/minseong0324/connectivity-js?color=blue)](https://github.com/minseong0324/connectivity-js/blob/main/LICENSE) [![NPM Version](https://img.shields.io/npm/v/%40connectivity-js%2Freact)](https://www.npmjs.com/package/@connectivity-js/react)

React adapter for connectivity-js. Includes hooks and components for declarative online/offline UI.

## Installation

```sh
npm install @connectivity-js/react
```

Includes `@connectivity-js/core` — no separate install needed.

## Usage

```tsx
import {
  ConnectivityProvider,
  Connectivity,
  useConnectivity,
  useAction,
  browserOnlineDetector,
  actionOptions,
} from '@connectivity-js/react';

// 1. Wrap your app
function App() {
  return (
    <ConnectivityProvider
      detectors={[browserOnlineDetector()]}
      gracePeriodMs={3_000}
    >
      <MyApp />
    </ConnectivityProvider>
  );
}

// 2. Declarative offline UI
function Page() {
  return (
    <Connectivity fallback={<OfflineBanner />} delayMs={2_000}>
      <MainContent />
    </Connectivity>
  );
}

// 3. Status hook
function StatusBadge() {
  const { status } = useConnectivity();
  if (status === 'offline') return <span>Offline</span>;
  return <span>Online</span>;
}

// 4. Action with offline queue
const saveAction = actionOptions({
  actionKey: 'save',
  request: (input: { id: string; data: string }) => api.save(input),
  dedupeKey: (input) => input.id,
  whenOffline: 'queue',
});

function SaveButton({ id, data }: { id: string; data: string }) {
  const { execute, pendingCount } = useAction(saveAction, {
    onSuccess: () => toast.success('Saved'),
    onEnqueued: () => toast.info('Queued — will sync when back online'),
  });

  return (
    <button onClick={() => execute({ id, data })}>
      Save {pendingCount > 0 && `(${pendingCount} pending)`}
    </button>
  );
}
```

## Documentation

[Full documentation](https://connectivity-js-docs.vercel.app/en)
