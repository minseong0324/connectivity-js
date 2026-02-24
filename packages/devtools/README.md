<div align="center">
  <img width=340 height=340 src="https://github.com/user-attachments/assets/71b662a7-25ff-423c-9e11-55ef1e16112e" />
</div>

# @connectivity-js/devtools &middot; [![MIT License](https://img.shields.io/github/license/minseong0324/connectivity-js?color=blue)](https://github.com/minseong0324/connectivity-js/blob/main/LICENSE) [![NPM Version](https://img.shields.io/npm/v/%40connectivity-js%2Fdevtools)](https://www.npmjs.com/package/@connectivity-js/devtools)

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
