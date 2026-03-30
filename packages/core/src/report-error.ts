/**
 * Reports an error on a separate call stack so it surfaces to
 * global error handlers (window.onerror, process.uncaughtException)
 * without interrupting the current execution flow.
 *
 * In Node.js / SSR environments, this triggers `uncaughtException`
 * which may terminate the process if no handler is registered.
 */
export function reportError(error: unknown) {
  setTimeout(() => {
    throw error;
  }, 0);
}
