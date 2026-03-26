// @vitest-environment jsdom
import { afterEach, assert, beforeEach, describe, expect, test, vi } from 'vitest';
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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
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
      vi.fn().mockResolvedValue({ ok: true, status: 200, headers: new Headers() }),
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

    const detector = heartbeatDetector({ url: '/health', intervalMs: 1000, method: 'GET' });
    const cleanup = detector.start(() => {});

    await vi.advanceTimersByTimeAsync(0);

    expect(fetchMock).toHaveBeenCalledWith(
      '/health',
      expect.objectContaining({ method: 'GET' }),
    );

    cleanup();
  });

  test('reports offline on fetch error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    vi.stubGlobal('performance', { now: vi.fn().mockReturnValue(0) });

    const events: DetectorEvent[] = [];
    const detector = heartbeatDetector({ url: '/health', intervalMs: 1000 });
    const cleanup = detector.start((e) => events.push(e));

    await vi.advanceTimersByTimeAsync(0);

    expect(events.some((e) => e.status === 'offline')).toBe(true);

    cleanup();
  });
});
