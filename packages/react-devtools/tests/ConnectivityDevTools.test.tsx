import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectivityDevTools } from '../src/ConnectivityDevTools';

const mockCleanup = vi.fn();

vi.mock('@connectivity-js/devtools', () => ({
  renderConnectivityDevTools: vi.fn(() => mockCleanup),
}));

const { renderConnectivityDevTools } = await import(
  '@connectivity-js/devtools'
);
const mockedRender = vi.mocked(renderConnectivityDevTools);

function createMockClient() {
  return {} as import('@connectivity-js/core').ConnectivityClient;
}

describe('ConnectivityDevTools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing when enabled is false', () => {
    const client = createMockClient();
    const { container } = render(
      <ConnectivityDevTools client={client} enabled={false} />,
    );

    expect(container.innerHTML).toBe('');
    expect(mockedRender).not.toHaveBeenCalled();
  });

  it('mounts devtools panel when enabled (default true)', () => {
    const client = createMockClient();
    render(<ConnectivityDevTools client={client} />);

    expect(mockedRender).toHaveBeenCalledTimes(1);
    expect(mockedRender).toHaveBeenCalledWith(
      expect.any(HTMLDivElement),
      client,
      expect.any(Object),
    );
  });

  it('cleans up on unmount', () => {
    const client = createMockClient();
    const { unmount } = render(<ConnectivityDevTools client={client} />);

    expect(mockedRender).toHaveBeenCalledTimes(1);
    expect(mockCleanup).not.toHaveBeenCalled();

    unmount();

    expect(mockCleanup).toHaveBeenCalledTimes(1);
  });

  it('re-mounts when client changes', () => {
    const clientA = createMockClient();
    const clientB = createMockClient();

    const { rerender } = render(<ConnectivityDevTools client={clientA} />);

    expect(mockedRender).toHaveBeenCalledTimes(1);
    expect(mockedRender).toHaveBeenLastCalledWith(
      expect.any(HTMLDivElement),
      clientA,
      expect.any(Object),
    );

    rerender(<ConnectivityDevTools client={clientB} />);

    expect(mockCleanup).toHaveBeenCalledTimes(1);
    expect(mockedRender).toHaveBeenCalledTimes(2);
    expect(mockedRender).toHaveBeenLastCalledWith(
      expect.any(HTMLDivElement),
      clientB,
      expect.any(Object),
    );
  });

  it('renders nothing when enabled toggles from true to false', () => {
    const client = createMockClient();
    const { container, rerender } = render(
      <ConnectivityDevTools client={client} enabled={true} />,
    );

    expect(mockedRender).toHaveBeenCalledTimes(1);
    expect(container.querySelector('div')).not.toBeNull();

    rerender(<ConnectivityDevTools client={client} enabled={false} />);

    expect(mockCleanup).toHaveBeenCalledTimes(1);
    expect(container.innerHTML).toBe('');
  });

  it('re-mounts when enabled toggles from false to true', () => {
    const client = createMockClient();
    const { rerender } = render(
      <ConnectivityDevTools client={client} enabled={false} />,
    );

    expect(mockedRender).not.toHaveBeenCalled();

    rerender(<ConnectivityDevTools client={client} enabled={true} />);

    expect(mockedRender).toHaveBeenCalledTimes(1);
  });

  it('passes defaultPosition option to renderConnectivityDevTools', () => {
    const client = createMockClient();
    render(
      <ConnectivityDevTools client={client} defaultPosition="bottom-left" />,
    );

    expect(mockedRender).toHaveBeenCalledWith(
      expect.any(HTMLDivElement),
      client,
      expect.objectContaining({ position: 'bottom-left' }),
    );
  });

  it('passes defaultOpen option to renderConnectivityDevTools', () => {
    const client = createMockClient();
    render(<ConnectivityDevTools client={client} defaultOpen={false} />);

    expect(mockedRender).toHaveBeenCalledWith(
      expect.any(HTMLDivElement),
      client,
      expect.objectContaining({ initialOpen: false }),
    );
  });
});
