---
"@connectivity-js/core": patch
"@connectivity-js/react": patch
---

fix(core): isolate listener errors in #notifyState/#notifyQueue, count only active jobs for maxQueueSize, return latest error in getCurrentResult

fix(react): emit useConnectivityClient provider warning only once per module lifecycle
