import type { ConnectionQuality, Detector, DetectorEvent } from './types';

const getConnectionQuality = (rttMs: number) => {
  const connection = (
    navigator as Navigator & {
      connection?: { effectiveType?: string; downlink?: number };
    }
  ).connection;

  return {
    rttMs,
    effectiveType: connection?.effectiveType,
    downlink: connection?.downlink,
  } satisfies ConnectionQuality;
};

/**
 * A detector that senses the browser's `navigator.onLine` property and `online`/`offline` events.
 *
 * Emits the current status immediately on initialization, then reacts to browser events.
 * Lightweight enough to serve as the default detector for most apps.
 *
 * @returns A {@link Detector} instance
 *
 * @example
 * const client = getConnectivityClient({
 *   detectors: [browserOnlineDetector()],
 * });
 */
export function browserOnlineDetector(): Detector {
  return {
    start: (listener) => {
      const onOnline = () =>
        listener({ status: 'online', reason: 'navigator' });
      const onOffline = () =>
        listener({ status: 'offline', reason: 'navigator' });

      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);
      listener({
        status: navigator.onLine ? 'online' : 'offline',
        reason: 'navigator',
      });

      return () => {
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
      };
    },
  };
}

type HeartbeatDetectorOptions = {
  /** URL of the health-check endpoint */
  url: string;
  /** Polling interval in milliseconds (default: `30_000`) */
  intervalMs?: number;
  /** Request timeout in milliseconds (default: `5_000`) */
  timeoutMs?: number;
  /** HTTP method for the health-check request (default: `'HEAD'`) */
  method?: 'HEAD' | 'GET';
  /** Custom response validator. When provided, overrides the default `response.ok` check */
  validateResponse?: (response: Response) => boolean;
};

const DEFAULT_HEARTBEAT_INTERVAL_MS = 30_000;
const DEFAULT_HEARTBEAT_TIMEOUT_MS = 5_000;

/**
 * A detector that periodically sends HEAD requests to a server to verify actual reachability.
 *
 * Because `browserOnlineDetector` only detects OS-level network connectivity,
 * use this detector alongside it when you need to verify server reachability.
 * On a successful request, it provides RTT and Network Information API data as `quality`.
 *
 * @param options - Heartbeat configuration
 * @returns A {@link Detector} instance
 *
 * @example
 * const client = getConnectivityClient({
 *   detectors: [
 *     browserOnlineDetector(),
 *     heartbeatDetector({ url: '/api/health', intervalMs: 10_000 }),
 *   ],
 * });
 */
export function heartbeatDetector(options: HeartbeatDetectorOptions) {
  return {
    start: (listener) => {
      const url = options.url;
      const intervalMs = options.intervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
      const timeoutMs = options.timeoutMs ?? DEFAULT_HEARTBEAT_TIMEOUT_MS;
      const method = options.method ?? 'HEAD';
      const validateResponse = options.validateResponse;

      let currentStatus: DetectorEvent['status'] = 'unknown';
      let activeController: AbortController | null = null;
      let stopped = false;

      const probe = async () => {
        if (stopped) {
          return;
        }
        activeController?.abort();
        const controller = new AbortController();
        activeController = controller;
        const start = performance.now();
        let timedOut = false;
        const timer = setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs);

        try {
          const response = await fetch(url, {
            method,
            cache: 'no-store',
            signal: controller.signal,
          });
          if (stopped) {
            return;
          }
          const isHealthy =
            validateResponse !== undefined
              ? validateResponse(response)
              : response.ok;
          if (!isHealthy) {
            if (currentStatus !== 'offline') {
              currentStatus = 'offline';
              listener({ status: 'offline', reason: 'heartbeat' });
            }
            return;
          }
          const rttMs = Math.round(performance.now() - start);
          const quality = getConnectionQuality(rttMs);
          listener({ status: 'online', reason: 'heartbeat', quality });
          currentStatus = 'online';
        } catch {
          if (stopped) {
            return;
          }
          if (controller.signal.aborted && !timedOut) {
            return;
          }
          if (currentStatus !== 'offline') {
            currentStatus = 'offline';
            listener({ status: 'offline', reason: 'heartbeat' });
          }
        } finally {
          clearTimeout(timer);
          if (activeController === controller) {
            activeController = null;
          }
        }
      };

      void probe();
      const intervalId = setInterval(() => void probe(), intervalMs);

      return () => {
        stopped = true;
        clearInterval(intervalId);
        activeController?.abort();
      };
    },
  } satisfies Detector;
}
