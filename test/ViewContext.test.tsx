import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ForgeContextProvider, useForgeContext } from '../src/ViewContext';
import { ForgeContextError } from '../src/errors';
import type { ForgeContext } from '../src/types';

// Mock @forge/bridge so tests never need a real Forge environment
vi.mock('@forge/bridge', () => ({
  view: {
    getContext: vi.fn(),
  },
}));

// Import the mocked view so we can control it per-test
import { view } from '@forge/bridge';
const mockGetContext = vi.mocked(view.getContext);

const mockContext: ForgeContext = {
  accountId: 'account-123',
  cloudId: 'cloud-abc',
  extension: {},
  localId: 'local-1',
  locale: 'en-US',
  moduleKey: 'my-module',
  siteUrl: 'https://example.atlassian.net',
  timezone: 'UTC',
};

// Helper: a consumer that calls useForgeContext and renders the moduleKey
function ContextConsumer () {
  const ctx = useForgeContext();
  return <div data-testid="module-key">{ctx.moduleKey}</div>;
}

// Helper: render within a provider that resolves to mockContext by default
function renderWithProvider (
  ui: React.ReactNode,
  options?: { fallback?: React.ReactNode; onError?: (e: unknown) => void }
) {
  return render(
    <ForgeContextProvider fallback={options?.fallback} onError={options?.onError}>
      {ui}
    </ForgeContextProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ForgeContextProvider', () => {
  it('renders null by default while context is loading', () => {
    // Never resolves during this test
    mockGetContext.mockReturnValue(new Promise(() => {}));
    const { container } = render(
      <ForgeContextProvider>
        <div>children</div>
      </ForgeContextProvider>
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the fallback while context is loading', () => {
    mockGetContext.mockReturnValue(new Promise(() => {}));
    renderWithProvider(<div>children</div>, { fallback: <div>Loading...</div> });
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('children')).not.toBeInTheDocument();
  });

  it('renders children once context resolves', async () => {
    mockGetContext.mockResolvedValue(mockContext);
    renderWithProvider(<div>children</div>);
    await waitFor(() => expect(screen.getByText('children')).toBeInTheDocument());
  });

  it('does not render children while loading', () => {
    mockGetContext.mockReturnValue(new Promise(() => {}));
    renderWithProvider(<div>children</div>);
    expect(screen.queryByText('children')).not.toBeInTheDocument();
  });

  it('provides the correct context value to useForgeContext()', async () => {
    mockGetContext.mockResolvedValue(mockContext);
    renderWithProvider(<ContextConsumer />);
    await waitFor(() =>
      expect(screen.getByTestId('module-key')).toHaveTextContent('my-module')
    );
  });

  it('calls onError when view.getContext() rejects', async () => {
    const error = new Error('bridge failed');
    mockGetContext.mockRejectedValue(error);
    const onError = vi.fn();
    renderWithProvider(<div>children</div>, { onError });
    await waitFor(() => expect(onError).toHaveBeenCalledWith(error));
  });

  it('does not render children when view.getContext() rejects', async () => {
    mockGetContext.mockRejectedValue(new Error('bridge failed'));
    const onError = vi.fn();
    renderWithProvider(<div>children</div>, { fallback: <div>Loading...</div>, onError });
    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(screen.queryByText('children')).not.toBeInTheDocument();
  });
});

describe('useForgeContext', () => {
  it('throws a ForgeContextError when used outside a provider', () => {
    // Suppress expected React error boundary console output
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ContextConsumer />)).toThrow(ForgeContextError);
    consoleError.mockRestore();
  });

  it('returns the context when inside a provider', async () => {
    mockGetContext.mockResolvedValue(mockContext);
    renderWithProvider(<ContextConsumer />);
    await waitFor(() =>
      expect(screen.getByTestId('module-key')).toHaveTextContent('my-module')
    );
  });
});
