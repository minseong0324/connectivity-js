import { describe, expectTypeOf, it } from 'vitest';
import { getConnectivityClient } from '../src/connectivity-client';
import type {
  ActionRunResult,
  ConnectivityState,
  ConnectivityTransition,
  Detector,
  Unsubscribe,
} from '../src/types';

describe('getConnectivityClient', () => {
  it('returns ConnectivityClient when called with options containing detectors', () => {
    const detector: Detector = { start: (_l) => () => {} };
    const client = getConnectivityClient({ detectors: [detector] });
    expectTypeOf(client.getState()).toExtend<ConnectivityState>();
  });

  it('can be called without arguments (options is optional)', () => {
    const client = getConnectivityClient();
    expectTypeOf(client.getState()).toExtend<ConnectivityState>();
  });

  it('type error when options are passed without detectors', () => {
    // @ts-expect-error — detectors is required in ConnectivityClientOptions
    getConnectivityClient({ gracePeriodMs: 3_000 });
  });
});

describe('ConnectivityClient.execute', () => {
  const client = getConnectivityClient();

  // execute() return type is Promise<ActionRunResult>
  expectTypeOf(client.execute).returns.toExtend<Promise<ActionRunResult>>();

  it('can narrow return value to ActionRunResult for use', async () => {
    const result = await client.execute('save', {});
    expectTypeOf(result).toExtend<ActionRunResult>();
  });

  it('jobId is narrowed to string in enqueued === true branch', async () => {
    const result = await client.execute('save', {});
    if (result.enqueued) {
      expectTypeOf(result.jobId).toBeString();
    }
  });

  it('result is narrowed to unknown in enqueued === false branch', async () => {
    const result = await client.execute('save', {});
    if (!result.enqueued) {
      expectTypeOf(result.result).toBeUnknown();
    }
  });
});

describe('ConnectivityClient.subscribe', () => {
  const client = getConnectivityClient();

  // subscribe() return type is Unsubscribe (() => void)
  expectTypeOf(client.subscribe).returns.toExtend<Unsubscribe>();

  it('callback first argument is ConnectivityState', () => {
    client.subscribe((state) => {
      expectTypeOf(state).toExtend<ConnectivityState>();
    });
  });

  it('callback second argument is ConnectivityTransition | undefined (undefined on initial mount)', () => {
    client.subscribe((_state, transition) => {
      expectTypeOf(transition).toExtend<ConnectivityTransition | undefined>();
    });
  });
});
