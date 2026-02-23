import { describe, expectTypeOf, it } from 'vitest';
import type { ConnectivityStatus, ConnectivityTransition } from '@connectivity-js/core';
import { useOnConnectivityChange } from '../src/use-on-connectivity-change';

describe('useOnConnectivityChange', () => {
  describe('handler parameter types', () => {
    it('each status handler parameter is ConnectivityTransition', () => {
      useOnConnectivityChange({
        online: (transition) => {
          expectTypeOf(transition).toExtend<ConnectivityTransition>();

          // from/to are ConnectivityStatus type
          expectTypeOf(transition.from).toExtend<ConnectivityStatus>();
          expectTypeOf(transition.to).toExtend<ConnectivityStatus>();

          // duration is time previous status was maintained (ms), number type
          expectTypeOf(transition.duration).toBeNumber();
        },
        offline: (transition) => {
          expectTypeOf(transition).toExtend<ConnectivityTransition>();
        },
        unknown: (transition) => {
          expectTypeOf(transition).toExtend<ConnectivityTransition>();
        },
      });
    });
  });

  describe('all handlers are optional (Partial<Record<...>>)', () => {
    it('no error when passing no handlers', () => {
      useOnConnectivityChange({});
    });

    it('no error when passing only online handler', () => {
      useOnConnectivityChange({
        online: (transition) => {
          console.log(`reconnected after ${transition.duration}ms`);
        },
      });
    });

    it('no error when passing only offline handler', () => {
      useOnConnectivityChange({
        offline: () => {},
      });
    });
  });

  describe('type error cases', () => {
    it('type error when registering handler for invalid status key', () => {
      useOnConnectivityChange({
        // @ts-expect-error — 'connecting' is not in ConnectivityStatus
        connecting: () => {},
      });
    });
  });
});
