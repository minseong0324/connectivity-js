/**
 * Reports an error on a separate call stack so it surfaces to
 * global error handlers (window.onerror, process.uncaughtException)
 * without interrupting the current execution flow.
 *
 * **SSR / Node.js note:** In server-side environments, the thrown error
 * will surface via `process.uncaughtException`. Ensure an appropriate
 * handler is registered to avoid crashing the process.
 */
export function reportError(error: unknown) {
  setTimeout(() => {
    throw error;
  }, 0);
}
