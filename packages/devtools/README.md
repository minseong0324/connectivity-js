# @connectivity-js/devtools &middot; [![MIT License](https://img.shields.io/github/license/minseong0324/connectivity-js?color=blue)](https://github.com/minseong0324/connectivity-js/blob/main/LICENSE) [![NPM Version](https://img.shields.io/npm/v/%40connectivity-js%2Fdevtools)](https://www.npmjs.com/package/@connectivity-js/devtools)

<div align="center">
  <img src="https://raw.githubusercontent.com/minseong0324/connectivity-js/main/docs/public/img/og-webp.webp" alt="connectivity-js" width="600" />
</div>

Framework-agnostic DevTools panel for connectivity-js. Renders a debug panel into a DOM element showing real-time job queue state.

> **Note:** If you are using React, install [`@connectivity-js/react-devtools`](https://www.npmjs.com/package/@connectivity-js/react-devtools) instead — it wraps this package automatically.

## Installation

```sh
npm install @connectivity-js/devtools
```

## Usage

```ts
import { createConnectivityDevTools } from '@connectivity-js/devtools';
import { getConnectivityClient } from '@connectivity-js/core';

const client = getConnectivityClient();
const container = document.getElementById('devtools');

const devtools = createConnectivityDevTools({ client, enabled: true });
devtools.mount(container);

// Cleanup
devtools.unmount();
```

## Documentation

[Full documentation](https://connectivity-js-docs.vercel.app/en/advanced/devtools)
