---
"@connectivity-js/react": patch
---

Eliminate unnecessary re-renders caused by unstable Context value.

- Split single Context into ClientContext + DefaultOptionsContext
- Stabilize defaultOptions reference with shallow comparison
- Clean up onJobError handler on Provider unmount
- Stabilize retry/cancel references in useQueue with useCallback
- Add dev-mode warning when hooks are used outside Provider
