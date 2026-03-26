// @vitest-environment jsdom
import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';
import { browserOnlineDetector, heartbeatDetector } from '../src/detectors';
import type { DetectorEvent } from '../src/types';

describe('browserOnlineDetector', () => {
  let originalOnLine: boolean;

  beforeEach(() => {
    originalOnLine = navigator.onLine;
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', {
      value: originalOnLine,
      configurable: true,
    });
  });

  test('emits initial state on start', () => {
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
    });

    const detector = browserOnlineDetector();
    const events: DetectorEvent[] = [];
    const cleanup = detector.start((event) => events.push(event));

    expect(events).toHaveLength(1);
    const firstEvent = events[0];
    assert(firstEvent !== undefined);
    expect(firstEvent.status).toBe('online');
    expect(firstEvent.reason).toBe('navigator');

    cleanup();
  });

  test('delivers online/offline events', () => {
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
    });

    const detector = browserOnlineDetector();
    const events: DetectorEvent[] = [];
    const cleanup = detector.start((event) => events.push(event));

    // after initial emit
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('online'));

    expect(events).toHaveLength(3);
    const offlineEvent = events[1];
    const onlineEvent = events[2];
    assert(offlineEvent !== undefined);
    assert(onlineEvent !== undefined);
    expect(offlineEvent.status).toBe('offline');
    expect(onlineEvent.status).toBe('online');

    cleanup();
  });

  test('events are not delivered after cleanup', () => {
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
    });

    const detector = browserOnlineDetector();
    const events: DetectorEvent[] = [];
    const cleanup = detector.start((event) => events.push(event));

    cleanup();

    window.dispatchEvent(new Event('offline'));
    // no additional events after initial emit(1)
    expect(events).toHaveLength(1);
  });
});

describe('heartbeatDetector', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test('reports offline when response is not ok (HTTP 500)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );
    vi.stubGlobal('performance', { now: vi.fn().mockReturnValue(0) });

    const events: DetectorEvent[] = [];
    const detector = heartbeatDetector({ url: '/health', intervalMs: 1000 });
    const cleanup = detector.start((e) => events.push(e));

    await vi.advanceTimersByTimeAsync(0);

    expect(events.some((e) => e.status === 'offline')).toBe(true);
    expect(events.every((e) => e.status !== 'online')).toBe(true);

    cleanup();
  });

  test('reports online when response is ok (HTTP 200)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200 }),
    );
    vi.stubGlobal('performance', { now: vi.fn().mockReturnValue(0) });

    const events: DetectorEvent[] = [];
    const detector = heartbeatDetector({ url: '/health', intervalMs: 1000 });
    const cleanup = detector.start((e) => events.push(e));

    await vi.advanceTimersByTimeAsync(0);

    expect(events.some((e) => e.status === 'online')).toBe(true);

    cleanup();
  });

  test('uses custom validateResponse when provided', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: true, status: 200, headers: new Headers() }),
    );
    vi.stubGlobal('performance', { now: vi.fn().mockReturnValue(0) });

    const events: DetectorEvent[] = [];
    const detector = heartbeatDetector({
      url: '/health',
      intervalMs: 1000,
      validateResponse: () => false,
    });
    const cleanup = detector.start((e) => events.push(e));

    await vi.advanceTimersByTimeAsync(0);

    expect(events.some((e) => e.status === 'offline')).toBe(true);

    cleanup();
  });

  test('uses specified HTTP method', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('performance', { now: vi.fn().mockReturnValue(0) });

    const detector = heartbeatDetector({
      url: '/health',
      intervalMs: 1000,
      method: 'GET',
    });
    const cleanup = detector.start(() => {});

    await vi.advanceTimersByTimeAsync(0);

    expect(fetchMock).toHaveBeenCalledWith(
      '/health',
      expect.objectContaining({ method: 'GET' }),
    );

    cleanup();
  });

  test('reports offline on fetch error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network error')),
    );
    vi.stubGlobal('performance', { now: vi.fn().mockReturnValue(0) });

    const events: DetectorEvent[] = [];
    const detector = heartbeatDetector({ url: '/health', intervalMs: 1000 });
    const cleanup = detector.start((e) => events.push(e));

    await vi.advanceTimersByTimeAsync(0);

    expect(events.some((e) => e.status === 'offline')).toBe(true);

    cleanup();
  });

  test('successful probe emits online with quality.rttMs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200 }),
    );
    let callCount = 0;
    vi.stubGlobal('performance', {
      now: vi.fn().mockImplementation(() => {
        callCount++;
        // First call returns 100, second returns 150 (rttMs = 50)
        if (callCount <= 1) {
          return 100;
        }
        return 150;
      }),
    });

    const events: DetectorEvent[] = [];
    const detector = heartbeatDetector({ url: '/health', intervalMs: 5000 });
    const cleanup = detector.start((e) => events.push(e));

    await vi.advanceTimersByTimeAsync(0);

    const onlineEvent = events.find((e) => e.status === 'online');
    expect(onlineEvent).toBeDefined();
    expect(onlineEvent?.quality).toBeDefined();
    expect(onlineEvent?.quality?.rttMs).toBe(50);

    cleanup();
  });

  test('timeout via AbortController emits offline', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          const signal = init.signal;
          if (signal !== undefined && signal !== null) {
            signal.addEventListener('abort', () => {
              reject(
                new DOMException('The operation was aborted.', 'AbortError'),
              );
            });
          }
        });
      }),
    );
    vi.stubGlobal('performance', { now: vi.fn().mockReturnValue(0) });

    const events: DetectorEvent[] = [];
    const detector = heartbeatDetector({
      url: '/health',
      intervalMs: 30000,
      timeoutMs: 1000,
    });
    const cleanup = detector.start((e) => events.push(e));

    // Advance past the timeout
    await vi.advanceTimersByTimeAsync(1500);

    expect(events.some((e) => e.status === 'offline')).toBe(true);

    cleanup();
  });

  test('cleanup aborts in-flight request', async () => {
    let abortSignal: AbortSignal | null | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        abortSignal = init.signal;
        return new Promise(() => {
          // Never resolves
        });
      }),
    );
    vi.stubGlobal('performance', { now: vi.fn().mockReturnValue(0) });

    const events: DetectorEvent[] = [];
    const detector = heartbeatDetector({ url: '/health', intervalMs: 30000 });
    const cleanup = detector.start((e) => events.push(e));

    // Wait for probe to start
    await vi.advanceTimersByTimeAsync(0);

    expect(abortSignal).toBeDefined();
    expect(abortSignal?.aborted).toBe(false);

    cleanup();

    expect(abortSignal?.aborted).toBe(true);
  });

  test('after cleanup, no more emits', async () => {
    let fetchCallCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => {
        fetchCallCount++;
        return Promise.resolve({ ok: true, status: 200 });
      }),
    );
    vi.stubGlobal('performance', { now: vi.fn().mockReturnValue(0) });

    const events: DetectorEvent[] = [];
    const detector = heartbeatDetector({ url: '/health', intervalMs: 1000 });
    const cleanup = detector.start((e) => events.push(e));

    await vi.advanceTimersByTimeAsync(0);
    const eventsAfterFirstProbe = events.length;

    cleanup();

    // Advance past several intervals
    await vi.advanceTimersByTimeAsync(5000);

    expect(events).toHaveLength(eventsAfterFirstProbe);
  });

  test('repeated offline suppresses duplicate emits', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network error')),
    );
    vi.stubGlobal('performance', { now: vi.fn().mockReturnValue(0) });

    const events: DetectorEvent[] = [];
    const detector = heartbeatDetector({ url: '/health', intervalMs: 1000 });
    const cleanup = detector.start((e) => events.push(e));

    // First probe -> offline
    await vi.advanceTimersByTimeAsync(0);
    const offlineCount1 = events.filter((e) => e.status === 'offline').length;
    expect(offlineCount1).toBe(1);

    // Second probe -> still offline, should be suppressed
    await vi.advanceTimersByTimeAsync(1000);
    const offlineCount2 = events.filter((e) => e.status === 'offline').length;
    expect(offlineCount2).toBe(1);

    // Third probe -> still offline, should be suppressed
    await vi.advanceTimersByTimeAsync(1000);
    const offlineCount3 = events.filter((e) => e.status === 'offline').length;
    expect(offlineCount3).toBe(1);

    cleanup();
  });

  test('interval-based repeated probes', async () => {
    let fetchCallCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => {
        fetchCallCount++;
        return Promise.resolve({ ok: true, status: 200 });
      }),
    );
    vi.stubGlobal('performance', { now: vi.fn().mockReturnValue(0) });

    const events: DetectorEvent[] = [];
    const detector = heartbeatDetector({ url: '/health', intervalMs: 2000 });
    const cleanup = detector.start((e) => events.push(e));

    // Initial probe
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchCallCount).toBe(1);

    // After 2s -> second probe
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetchCallCount).toBe(2);

    // After another 2s -> third probe
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetchCallCount).toBe(3);

    // Each online probe emits an event
    const onlineEvents = events.filter((e) => e.status === 'online');
    expect(onlineEvents.length).toBe(3);

    cleanup();
  });
});
