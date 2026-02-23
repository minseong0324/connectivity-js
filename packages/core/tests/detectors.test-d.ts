import { describe, expectTypeOf, it } from 'vitest';
import { browserOnlineDetector, heartbeatDetector } from '../src/detectors';
import type { Detector, DetectorEvent } from '../src/types';

describe('browserOnlineDetector', () => {
  // Return type is compatible with Detector interface
  expectTypeOf(browserOnlineDetector()).toExtend<Detector>();
});

describe('heartbeatDetector', () => {
  it('returns Detector when url is passed', () => {
    expectTypeOf(
      heartbeatDetector({ url: '/api/health' }),
    ).toExtend<Detector>();
  });

  it('returns Detector when url and optional options are passed', () => {
    expectTypeOf(
      heartbeatDetector({
        url: '/api/health',
        intervalMs: 10_000,
        timeoutMs: 3_000,
      }),
    ).toExtend<Detector>();
  });

  it('type error when called without url', () => {
    // @ts-expect-error — url is required in HeartbeatDetectorOptions
    heartbeatDetector({ intervalMs: 10_000 });
  });

  it('type error when passing non-string to url', () => {
    // @ts-expect-error — url must be string type
    heartbeatDetector({ url: 42 });
  });
});

describe('custom Detector implementation', () => {
  it('implementation that returns cleanup from start is assignable to Detector', () => {
    const customDetector: Detector = {
      start: (listener) => {
        // listener parameter is DetectorEvent type
        expectTypeOf(listener).parameter(0).toExtend<DetectorEvent>();

        listener({ status: 'online', reason: 'custom' });
        return () => {}; // return cleanup function
      },
    };

    expectTypeOf(customDetector).toExtend<Detector>();
  });

  it('cannot assign to Detector when start does not return cleanup function', () => {
    const invalidDetector = {
      start: (_listener: (event: DetectorEvent) => void) => {
        // no cleanup function returned — return type is void
      },
    };

    // void is not assignable to () => void (cleanup function type)
    // @ts-expect-error — start return type must be () => void but is void
    const typed: Detector = invalidDetector;
    void typed;
  });

  it('type error when DetectorEvent status field has invalid value', () => {
    const detector: Detector = {
      start: (listener) => {
        // @ts-expect-error — 'connecting' is not a valid ConnectivityStatus
        listener({ status: 'connecting', reason: 'custom' });
        return () => {};
      },
    };

    void detector;
  });
});
