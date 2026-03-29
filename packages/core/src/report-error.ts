/**
 * Reports an error on a separate call stack so it surfaces to
 * global error handlers (window.onerror, process.uncaughtException)
 * without interrupting the current execution flow.
 */
export function reportError(error: unknown) {
  setTimeout(() => {
    throw error;
  }, 0);
}
