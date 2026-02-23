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

  test('start 시 초기 상태를 emit한다', () => {
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

  test('online/offline 이벤트를 전달한다', () => {
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
    });

    const detector = browserOnlineDetector();
    const events: DetectorEvent[] = [];
    const cleanup = detector.start((event) => events.push(event));

    // 초기 emit 이후
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

  test('cleanup 후 이벤트가 전달되지 않는다', () => {
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
    });

    const detector = browserOnlineDetector();
    const events: DetectorEvent[] = [];
    const cleanup = detector.start((event) => events.push(event));

    cleanup();

    window.dispatchEvent(new Event('offline'));
    // 초기 emit(1) 이후 추가 이벤트 없음
    expect(events).toHaveLength(1);
  });
});
