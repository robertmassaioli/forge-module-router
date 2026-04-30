import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ForgeContextProvider, useForgeContext, AllowedModuleKeysContext } from '../src/ViewContext';
import { ForgeContextError, ForgeModuleKeyConflictError } from '../src/errors';
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
  options?: { fallback?: React.ReactNode; onError?: (e: unknown) => void; allowedModuleKeys?: readonly string[] }
) {
  return render(
    <ForgeContextProvider
      fallback={options?.fallback}
      onError={options?.onError}
      allowedModuleKeys={options?.allowedModuleKeys}
    >
      {ui}
    </ForgeContextProvider>
  );
}

// Helper: consumer that reads AllowedModuleKeysContext directly for inspection
function AllowedKeysConsumer ({ onKeys }: { onKeys: (keys: ReadonlySet<string> | null) => void }) {
  const keys = React.useContext(AllowedModuleKeysContext);
  onKeys(keys);
  return null;
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

// Minimal error boundary for catching render errors in tests
class TestErrorBoundary extends React.Component<
  { children: React.ReactNode; onError?: (err: unknown) => void },
  { error: unknown }
> {
  constructor (props: { children: React.ReactNode; onError?: (err: unknown) => void }) {
    super(props);
    this.state = { error: undefined };
  }
  static getDerivedStateFromError (error: unknown) { return { error }; }
  componentDidCatch (error: unknown) { this.props.onError?.(error); }
  render () {
    if (this.state.error !== undefined) return <div>error-boundary</div>;
    return this.props.children;
  }
}

function renderWithProviderAndBoundary (
  ui: React.ReactNode,
  options?: { allowedModuleKeys?: readonly string[] },
  onError?: (err: unknown) => void
) {
  return render(
    <TestErrorBoundary onError={onError}>
      <ForgeContextProvider allowedModuleKeys={options?.allowedModuleKeys}>
        {ui}
      </ForgeContextProvider>
    </TestErrorBoundary>
  );
}

describe('ForgeContextProvider — allowedModuleKeys', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.mocked(console.error).mockRestore();
  });

  it('provides null AllowedModuleKeysContext when allowedModuleKeys is not specified', async () => {
    mockGetContext.mockResolvedValue(mockContext);
    let capturedKeys: ReadonlySet<string> | null | undefined = undefined;
    renderWithProvider(<AllowedKeysConsumer onKeys={(k) => { capturedKeys = k; }} />);
    await waitFor(() => expect(capturedKeys).not.toBeUndefined());
    expect(capturedKeys).toBeNull();
  });

  it('provides a Set from AllowedModuleKeysContext when allowedModuleKeys is specified', async () => {
    mockGetContext.mockResolvedValue(mockContext);
    let capturedKeys: ReadonlySet<string> | null | undefined = undefined;
    renderWithProvider(
      <AllowedKeysConsumer onKeys={(k) => { capturedKeys = k; }} />,
      { allowedModuleKeys: ['my-module', 'other-module'] }
    );
    await waitFor(() => expect(capturedKeys).not.toBeUndefined());
    expect(capturedKeys).toBeInstanceOf(Set);
    expect((capturedKeys as ReadonlySet<string>).has('my-module')).toBe(true);
    expect((capturedKeys as ReadonlySet<string>).has('other-module')).toBe(true);
  });

  it('catches ForgeModuleKeyConflictError in error boundary when two keys share a hyphen-prefix', async () => {
    mockGetContext.mockResolvedValue(mockContext);
    let caughtError: unknown;
    renderWithProviderAndBoundary(
      <div>children</div>,
      { allowedModuleKeys: ['my-macro', 'my-macro-v2', 'unrelated-module'] },
      (err) => { caughtError = err; }
    );
    // Error boundary catches the render error and shows fallback
    await waitFor(() => expect(screen.getByText('error-boundary')).toBeInTheDocument());
    expect(caughtError).toBeInstanceOf(ForgeModuleKeyConflictError);
  });

  it('ForgeModuleKeyConflictError names both conflicting keys', async () => {
    mockGetContext.mockResolvedValue(mockContext);
    let caughtError: unknown;
    renderWithProviderAndBoundary(
      <div>children</div>,
      { allowedModuleKeys: ['my-macro', 'my-macro-v2'] },
      (err) => { caughtError = err; }
    );
    await waitFor(() => expect(screen.getByText('error-boundary')).toBeInTheDocument());
    const error = caughtError as ForgeModuleKeyConflictError;
    expect(error).toBeInstanceOf(ForgeModuleKeyConflictError);
    expect(error.prefixKey).toBe('my-macro');
    expect(error.conflictingKey).toBe('my-macro-v2');
  });

  it('does NOT error when allowedModuleKeys has no prefix conflicts', async () => {
    mockGetContext.mockResolvedValue(mockContext);
    renderWithProviderAndBoundary(
      <div>children</div>,
      { allowedModuleKeys: ['paste-code-macro', 'gist-code-macro', 'my-panel'] }
    );
    await waitFor(() => expect(screen.getByText('children')).toBeInTheDocument());
    expect(screen.queryByText('error-boundary')).not.toBeInTheDocument();
  });

  it('does NOT error for keys that share a prefix but not a hyphen-prefix relationship', async () => {
    // 'macro' and 'macroext' — 'macroext' does NOT start with 'macro-' so no conflict
    mockGetContext.mockResolvedValue(mockContext);
    renderWithProviderAndBoundary(
      <div>children</div>,
      { allowedModuleKeys: ['macro', 'macroext'] }
    );
    await waitFor(() => expect(screen.getByText('children')).toBeInTheDocument());
    expect(screen.queryByText('error-boundary')).not.toBeInTheDocument();
  });

  it('catches conflict regardless of order in the allowedModuleKeys array', async () => {
    mockGetContext.mockResolvedValue(mockContext);
    let caughtError: unknown;
    // v2 listed before base key — should still detect the conflict
    renderWithProviderAndBoundary(
      <div>children</div>,
      { allowedModuleKeys: ['my-macro-v2', 'my-macro'] },
      (err) => { caughtError = err; }
    );
    await waitFor(() => expect(screen.getByText('error-boundary')).toBeInTheDocument());
    expect(caughtError).toBeInstanceOf(ForgeModuleKeyConflictError);
    const error = caughtError as ForgeModuleKeyConflictError;
    // Order may vary — check both keys are named
    expect([error.prefixKey, error.conflictingKey]).toContain('my-macro');
    expect([error.prefixKey, error.conflictingKey]).toContain('my-macro-v2');
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
