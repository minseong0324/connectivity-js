/** Delay in ms before a succeeded job is removed from the queue */
export const SUCCEEDED_JOB_CLEANUP_DELAY_MS = 5_000;

/** Default backoff delay in ms for retries */
export const DEFAULT_BACKOFF_MS = 1_000;

/**
 * Converts an error value to a human-readable string.
 *
 * @param error - Error value to convert
 * @returns `message` for Error instances, otherwise `String(error)`
 *
 * @example
 * toErrorMessage(new Error('failed')) // → 'failed'
 * toErrorMessage(42)                 // → '42'
 */
export function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Returns a Promise that resolves after the specified duration.
 *
 * @param ms - Duration to wait in milliseconds
 *
 * @example
 * await delay(1_000); // Wait 1 second
 */
export function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
