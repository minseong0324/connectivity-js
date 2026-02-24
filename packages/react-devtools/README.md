# @connectivity-js/react-devtools &middot; [![MIT License](https://img.shields.io/github/license/minseong0324/connectivity-js?color=blue)](https://github.com/minseong0324/connectivity-js/blob/main/LICENSE) [![NPM Version](https://img.shields.io/npm/v/%40connectivity-js%2Freact-devtools)](https://www.npmjs.com/package/@connectivity-js/react-devtools)

<div align="center">
  <img src="https://raw.githubusercontent.com/minseong0324/connectivity-js/main/docs/public/img/og-webp.webp" alt="connectivity-js" width="600" />
</div>

React DevTools panel for connectivity-js. Displays real-time job queue state during development.

## Installation

```sh
npm install @connectivity-js/react-devtools
```

Includes `@connectivity-js/devtools` — no separate install needed.

## Usage

```tsx
import { ConnectivityDevTools } from '@connectivity-js/react-devtools';
import { getConnectivityClient } from '@connectivity-js/core';

function App() {
  return (
    <>
      <MyApp />
      <ConnectivityDevTools
        client={getConnectivityClient()}
        enabled={process.env.NODE_ENV === 'development'}
      />
    </>
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `client` | `ConnectivityClient` | required | The client instance to observe |
| `enabled` | `boolean` | `true` | Show or hide the panel |

## Documentation

[Full documentation](https://connectivity-js-docs.vercel.app/en/advanced/devtools)
