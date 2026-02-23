import type { QueuedJob } from '@connectivity-js/core';
import { browserOnlineDetector } from '@connectivity-js/core';
import { describe, expectTypeOf, it } from 'vitest';
import { ConnectivityProvider } from '../src/connectivity-provider';

describe('ConnectivityProvider', () => {
  it('valid JSX when detectors is passed', () => {
    return (
      <ConnectivityProvider detectors={[browserOnlineDetector()]}>
        <div>test</div>
      </ConnectivityProvider>
    );
  });

  it('type error when detectors is missing', () => {
    return (
      // @ts-expect-error — detectors is required
      <ConnectivityProvider>
        <div>test</div>
      </ConnectivityProvider>
    );
  });

  it('type error when passing non-Detector[] to detectors', () => {
    return (
      <ConnectivityProvider
        // @ts-expect-error — string is not assignable to Detector[]
        detectors="wrong"
      >
        <div>test</div>
      </ConnectivityProvider>
    );
  });

  it('onJobError callback second parameter is QueuedJob', () => {
    return (
      <ConnectivityProvider
        detectors={[browserOnlineDetector()]}
        onJobError={(_error, job) => {
          // job should be inferred as QueuedJob type
          expectTypeOf(job).toExtend<QueuedJob>();
        }}
      >
        <div>test</div>
      </ConnectivityProvider>
    );
  });

  it('gracePeriodMs is optional number', () => {
    return (
      <ConnectivityProvider
        detectors={[browserOnlineDetector()]}
        gracePeriodMs={3_000}
      >
        <div>test</div>
      </ConnectivityProvider>
    );
  });

  it('type error when passing string to gracePeriodMs', () => {
    return (
      <ConnectivityProvider
        detectors={[browserOnlineDetector()]}
        // @ts-expect-error — gracePeriodMs must be number type
        gracePeriodMs="3000"
      >
        <div>test</div>
      </ConnectivityProvider>
    );
  });

  it('can pass value compatible with ActionOptions to defaultOptions.actions', () => {
    return (
      <ConnectivityProvider
        detectors={[browserOnlineDetector()]}
        defaultOptions={{
          actions: { whenOffline: 'queue' },
          connectivity: { delayMs: 2_000 },
        }}
      >
        <div>test</div>
      </ConnectivityProvider>
    );
  });
});
