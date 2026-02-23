import type {
  ConnectionQuality,
  ConnectivityStatus,
} from '@connectivity-js/core';
import { describe, expectTypeOf, it } from 'vitest';
import { useConnectivity } from '../src/use-connectivity';

describe('useConnectivity', () => {
  const state = useConnectivity();

  // status inferred as 'online' | 'offline' | 'unknown' union type
  expectTypeOf(state.status).toExtend<ConnectivityStatus>();

  // quality inferred as ConnectionQuality type
  expectTypeOf(state.quality).toExtend<ConnectionQuality>();

  // since is timestamp when status began, number type
  expectTypeOf(state.since).toBeNumber();

  // reason is optional string (status change reason provided by detector)
  expectTypeOf(state.reason).toExtend<string | undefined>();

  it('can branch on status value for online/offline cases', () => {
    const { status } = useConnectivity();

    // status composed of exactly three literal types
    expectTypeOf(status).toExtend<'online' | 'offline' | 'unknown'>();
  });

  it('all quality fields are optional', () => {
    const { quality } = useConnectivity();

    // all quality fields can include undefined
    expectTypeOf(quality.rttMs).toExtend<number | undefined>();
    expectTypeOf(quality.effectiveType).toExtend<string | undefined>();
    expectTypeOf(quality.downlink).toExtend<number | undefined>();
  });
});
