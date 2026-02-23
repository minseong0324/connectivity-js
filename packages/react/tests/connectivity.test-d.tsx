import { describe, it } from 'vitest';
import { Connectivity } from '../src/connectivity';

describe('Connectivity', () => {
  it('valid JSX when children is provided', () => {
    return (
      <Connectivity>
        <div>test</div>
      </Connectivity>
    );
  });

  it('type error when children is missing', () => {
    return (
      // @ts-expect-error — children is required
      <Connectivity />
    );
  });

  it('fallback is optional ReactNode', () => {
    // usable without fallback
    return (
      <Connectivity>
        <div>test</div>
      </Connectivity>
    );
  });

  it('no error when passing ReactNode to fallback', () => {
    return (
      <Connectivity fallback={<span>You are offline</span>}>
        <div>test</div>
      </Connectivity>
    );
  });

  it('delayMs is optional number', () => {
    return (
      <Connectivity delayMs={2_000}>
        <div>test</div>
      </Connectivity>
    );
  });

  it('type error when passing string to delayMs', () => {
    return (
      <Connectivity
        // @ts-expect-error — delayMs must be number type
        delayMs="2000"
      >
        <div>test</div>
      </Connectivity>
    );
  });
});
