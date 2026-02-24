// @vitest-environment jsdom
import { afterEach, assert, beforeEach, describe, expect, test } from 'vitest';
import { browserOnlineDetector } from '../src/detectors';
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
