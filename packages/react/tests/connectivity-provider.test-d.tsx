import type { QueuedJob } from '@connectivity-js/core';
import {
  ConnectivityClient,
  browserOnlineDetector,
} from '@connectivity-js/core';
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

  it('valid JSX when client is passed', () => {
    const client = new ConnectivityClient({
      detectors: [browserOnlineDetector()],
    });
    return (
      <ConnectivityProvider client={client}>
        <div>test</div>
      </ConnectivityProvider>
    );
  });

  it('type error when neither client nor detectors is passed', () => {
    return (
      // @ts-expect-error — client or detectors is required
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

  it('type error when passing both client and detectors', () => {
    const client = new ConnectivityClient({
      detectors: [browserOnlineDetector()],
    });
    return (
      // @ts-expect-error — client and detectors are mutually exclusive
      <ConnectivityProvider
        client={client}
        detectors={[browserOnlineDetector()]}
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

  it('type error when passing gracePeriodMs with client prop', () => {
    const client = new ConnectivityClient({
      detectors: [browserOnlineDetector()],
    });
    return (
      // @ts-expect-error — gracePeriodMs is not allowed with client prop
      <ConnectivityProvider
        client={client}
        gracePeriodMs={3_000}
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
