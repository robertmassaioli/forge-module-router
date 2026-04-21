/**
 * Version matrix fixture tests.
 *
 * These tests exercise the full public API of forge-module-router against
 * whatever peer dependency versions are installed in this fixture. They are
 * run by the matrix runner for each combination in the matrix.
 *
 * All three core scenarios must pass:
 * 1. ForgeContextProvider fetches and provides context
 * 2. ContextRoute filters by moduleKey / modalType / noModal
 * 3. SpaRouter navigates using the Forge history v4 (location, action) signature
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import {
  ForgeContextProvider,
  ContextRoute,
  SpaRouter,
  Link,
} from 'forge-module-router';

// ---------------------------------------------------------------------------
// @forge/bridge is stubbed by the matrix runner (its entry point is replaced
// with plain functions after npm install). We spy on those functions here.
// ---------------------------------------------------------------------------
import { view } from '@forge/bridge';
const mockGetContext = vi.spyOn(view, 'getContext');
const mockCreateHistory = vi.spyOn(view, 'createHistory');

const MOCK_CONTEXT = {
  accountId: 'acc-123',
  cloudId: 'cloud-123',
  localId: 'local-123',
  locale: 'en-US',
  moduleKey: 'my-panel',
  siteUrl: 'https://example.atlassian.net',
  timezone: 'UTC',
  extension: {},
};

// ---------------------------------------------------------------------------
// Helper: fake Forge history using the v4 two-argument listener signature
// ---------------------------------------------------------------------------
function makeFakeForgeHistory (initialPath = '/') {
  type Loc = { pathname: string; search: string; hash: string; state: unknown; key: string };
  type ForgeListener = (location: Loc, action: string) => void;
  const listeners: ForgeListener[] = [];
  let currentLocation: Loc = { pathname: initialPath, search: '', hash: '', state: null, key: 'default' };
  let currentAction = 'POP';

  return {
    get action () { return currentAction; },
    get location () { return currentLocation; },
    // Forge uses history v4 signature: two positional args
    listen: vi.fn((cb: ForgeListener) => {
      listeners.push(cb);
      return () => { listeners.splice(listeners.indexOf(cb), 1); };
    }),
    push (to: string) {
      currentLocation = { pathname: to, search: '', hash: '', state: null, key: String(Math.random()) };
      currentAction = 'PUSH';
      listeners.forEach(cb => cb(currentLocation, currentAction));
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// 1. ForgeContextProvider
// ---------------------------------------------------------------------------
describe('ForgeContextProvider', () => {
  it('renders fallback while context is loading', () => {
    mockGetContext.mockReturnValue(new Promise(() => {}));
    render(
      <ForgeContextProvider fallback={<div>Loading...</div>}>
        <div>Content</div>
      </ForgeContextProvider>
    );
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('renders children once context resolves', async () => {
    mockGetContext.mockResolvedValue(MOCK_CONTEXT as never);
    render(
      <ForgeContextProvider>
        <div>Content</div>
      </ForgeContextProvider>
    );
    await waitFor(() => expect(screen.getByText('Content')).toBeInTheDocument());
  });
});

// ---------------------------------------------------------------------------
// 2. ContextRoute
// ---------------------------------------------------------------------------
describe('ContextRoute', () => {
  function renderWithContext (moduleKey: string, children: React.ReactNode) {
    mockGetContext.mockResolvedValue({ ...MOCK_CONTEXT, moduleKey } as never);
    return render(
      <ForgeContextProvider>
        {children}
      </ForgeContextProvider>
    );
  }

  it('renders children when moduleKey matches', async () => {
    renderWithContext('my-panel', (
      <ContextRoute moduleKey="my-panel">
        <div>Panel Content</div>
      </ContextRoute>
    ));
    await waitFor(() => expect(screen.getByText('Panel Content')).toBeInTheDocument());
  });

  it('does not render children when moduleKey does not match', async () => {
    // Use a sentinel to know when context has loaded
    renderWithContext('other-panel', (
      <>
        <div>Context Loaded</div>
        <ContextRoute moduleKey="my-panel">
          <div>Panel Content</div>
        </ContextRoute>
      </>
    ));
    // Wait for context to load, then verify mismatched content is absent
    await waitFor(() => expect(screen.getByText('Context Loaded')).toBeInTheDocument());
    expect(screen.queryByText('Panel Content')).not.toBeInTheDocument();
  });

  it('renders children when noModal and no modal in context', async () => {
    mockGetContext.mockResolvedValue({ ...MOCK_CONTEXT, extension: {} } as never);
    render(
      <ForgeContextProvider>
        <ContextRoute noModal>
          <div>No Modal Content</div>
        </ContextRoute>
      </ForgeContextProvider>
    );
    await waitFor(() => expect(screen.getByText('No Modal Content')).toBeInTheDocument());
  });

  it('does not render when noModal but modal is present', async () => {
    mockGetContext.mockResolvedValue({
      ...MOCK_CONTEXT,
      extension: { modal: { type: 'confirm' } },
    } as never);
    render(
      <ForgeContextProvider>
        <>
          <div>Context Loaded</div>
          <ContextRoute noModal>
            <div>No Modal Content</div>
          </ContextRoute>
        </>
      </ForgeContextProvider>
    );
    await waitFor(() => expect(screen.getByText('Context Loaded')).toBeInTheDocument());
    expect(screen.queryByText('No Modal Content')).not.toBeInTheDocument();
  });

  it('renders children when modalType matches', async () => {
    mockGetContext.mockResolvedValue({
      ...MOCK_CONTEXT,
      extension: { modal: { type: 'confirm' } },
    } as never);
    render(
      <ForgeContextProvider>
        <ContextRoute modalType="confirm">
          <div>Modal Content</div>
        </ContextRoute>
      </ForgeContextProvider>
    );
    await waitFor(() => expect(screen.getByText('Modal Content')).toBeInTheDocument());
  });
});

// ---------------------------------------------------------------------------
// 3. SpaRouter — Forge history path (v4 two-argument listener signature)
// ---------------------------------------------------------------------------
describe('SpaRouter with Forge history', () => {
  it('renders the initial route after Forge history resolves', async () => {
    const fakeHistory = makeFakeForgeHistory('/');
    mockCreateHistory.mockResolvedValue(fakeHistory as never);
    render(
      <SpaRouter>
        <Routes>
          <Route path="/" element={<div>Home Page</div>} />
          <Route path="/settings" element={<div>Settings Page</div>} />
        </Routes>
      </SpaRouter>
    );
    await waitFor(() => expect(screen.getByText('Home Page')).toBeInTheDocument());
  });

  it('navigates to a new route when Forge history fires (location, action)', async () => {
    const fakeHistory = makeFakeForgeHistory('/');
    mockCreateHistory.mockResolvedValue(fakeHistory as never);
    render(
      <SpaRouter>
        <Routes>
          <Route path="/" element={<div>Home Page</div>} />
          <Route path="/settings" element={<div>Settings Page</div>} />
        </Routes>
      </SpaRouter>
    );
    await waitFor(() => screen.getByText('Home Page'));
    fakeHistory.push('/settings');
    await waitFor(() => expect(screen.getByText('Settings Page')).toBeInTheDocument());
  });

  it('falls back to in-memory history when view.createHistory() rejects', async () => {
    mockCreateHistory.mockRejectedValue(new Error('not in Forge'));
    render(
      <SpaRouter>
        <Routes>
          <Route path="/" element={<div>Home Page</div>} />
        </Routes>
      </SpaRouter>
    );
    await waitFor(() => expect(screen.getByText('Home Page')).toBeInTheDocument());
  });
});

// ---------------------------------------------------------------------------
// 4. Link
// ---------------------------------------------------------------------------
describe('Link', () => {
  it('renders and navigates on click', async () => {
    // Use in-memory fallback (createHistory rejects) — Link uses useNavigate()
    // which works with both Forge history and in-memory history.
    mockCreateHistory.mockRejectedValue(new Error('use fallback'));
    const user = userEvent.setup();
    render(
      <SpaRouter>
        <Routes>
          <Route path="/" element={<Link to="/settings">Go to Settings</Link>} />
          <Route path="/settings" element={<div>Settings Page</div>} />
        </Routes>
      </SpaRouter>
    );
    await waitFor(() => screen.getByText('Go to Settings'));
    await user.click(screen.getByRole('link', { name: 'Go to Settings' }));
    await waitFor(() => expect(screen.getByText('Settings Page')).toBeInTheDocument());
  });
});
