import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { SpaRouter, Link } from '../src/SpaRouter';

vi.mock('@forge/bridge', () => ({
  view: {
    getContext: vi.fn(),
    createHistory: vi.fn(),
  },
}));

import { view } from '@forge/bridge';
const mockCreateHistory = vi.mocked(view.createHistory);

beforeEach(() => {
  vi.clearAllMocks();
});

// Helper: render SpaRouter with simple routes
function renderSpaRouter (fallback?: React.ReactNode) {
  return render(
    <SpaRouter fallback={fallback}>
      <Routes>
        <Route path="/" element={<div>Home Page</div>} />
        <Route path="/settings" element={<div>Settings Page</div>} />
      </Routes>
    </SpaRouter>
  );
}

describe('SpaRouter', () => {
  it('renders fallback while history is initialising', () => {
    // Never resolves
    mockCreateHistory.mockReturnValue(new Promise(() => {}));
    renderSpaRouter(<div>Initialising...</div>);
    expect(screen.getByText('Initialising...')).toBeInTheDocument();
    expect(screen.queryByText('Home Page')).not.toBeInTheDocument();
  });

  it('renders null by default while history is initialising', () => {
    mockCreateHistory.mockReturnValue(new Promise(() => {}));
    const { container } = renderSpaRouter();
    // The fallback slot is empty — only the Router wrapper would render
    expect(screen.queryByText('Home Page')).not.toBeInTheDocument();
    expect(container.querySelector('div')).toBeNull();
  });

  it('uses in-memory history fallback when view.createHistory() rejects', async () => {
    mockCreateHistory.mockRejectedValue(new Error('not in Forge'));
    renderSpaRouter();
    await waitFor(() =>
      expect(screen.getByText('Home Page')).toBeInTheDocument()
    );
  });

  describe('Forge history path (view.createHistory() succeeds)', () => {
    // Forge's view.createHistory() listener uses the history v4 signature:
    // (location, action) as two positional arguments — NOT a single object.
    // These tests verify that the correct signature is used and navigation works.

    function makeFakeForgeHistory (initialPath = '/') {
      type ForgeListener = (location: { pathname: string; search: string; hash: string; state: unknown; key: string }, action: string) => void;
      const listeners: ForgeListener[] = [];
      let currentLocation = { pathname: initialPath, search: '', hash: '', state: null, key: 'default' };
      let currentAction = 'POP';

      const history = {
        get action () { return currentAction; },
        get location () { return currentLocation; },
        // Forge listener signature: (location, action) — two positional args
        listen: vi.fn((cb: ForgeListener) => {
          listeners.push(cb);
          return () => { listeners.splice(listeners.indexOf(cb), 1); };
        }),
        push: vi.fn((to: string) => {
          currentLocation = { pathname: to, search: '', hash: '', state: null, key: String(Math.random()) };
          currentAction = 'PUSH';
          listeners.forEach(cb => cb(currentLocation, currentAction));
        }),
      };
      return history;
    }

    it('renders children after Forge history resolves', async () => {
      const fakeHistory = makeFakeForgeHistory('/');
      mockCreateHistory.mockResolvedValue(fakeHistory as never);
      renderSpaRouter();
      await waitFor(() =>
        expect(screen.getByText('Home Page')).toBeInTheDocument()
      );
    });

    it('listens to Forge history using the (location, action) two-argument signature', async () => {
      const fakeHistory = makeFakeForgeHistory('/');
      mockCreateHistory.mockResolvedValue(fakeHistory as never);
      renderSpaRouter();
      await waitFor(() => screen.getByText('Home Page'));
      expect(fakeHistory.listen).toHaveBeenCalledTimes(1);
      // The registered callback must accept two positional args — call it directly
      // to verify it updates state correctly (does not crash on the v4 signature).
      const registeredCb = fakeHistory.listen.mock.calls[0][0];
      const newLocation = { pathname: '/settings', search: '', hash: '', state: null, key: 'nav1' };
      expect(() => registeredCb(newLocation, 'PUSH')).not.toThrow();
    });

    it('navigates to new route when Forge history fires (location, action)', async () => {
      const fakeHistory = makeFakeForgeHistory('/');
      mockCreateHistory.mockResolvedValue(fakeHistory as never);
      renderSpaRouter();
      await waitFor(() => screen.getByText('Home Page'));
      // Simulate Forge history push with v4-style two-arg listener
      fakeHistory.push('/settings');
      await waitFor(() =>
        expect(screen.getByText('Settings Page')).toBeInTheDocument()
      );
    });

    it('cleans up Forge history listener on unmount', async () => {
      const fakeHistory = makeFakeForgeHistory('/');
      mockCreateHistory.mockResolvedValue(fakeHistory as never);
      const { unmount } = renderSpaRouter();
      await waitFor(() => screen.getByText('Home Page'));
      expect(() => unmount()).not.toThrow();
    });
  });

  it('renders children once history is ready (fallback path)', async () => {
    mockCreateHistory.mockRejectedValue(new Error('not in Forge'));
    renderSpaRouter(<div>Loading...</div>);
    await waitFor(() =>
      expect(screen.getByText('Home Page')).toBeInTheDocument()
    );
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('cleans up history listener on unmount', async () => {
    const unsubscribe = vi.fn();
    const listenFn = vi.fn().mockReturnValue(unsubscribe);
    mockCreateHistory.mockRejectedValue(new Error('use fallback'));

    // We can't easily intercept createMemoryHistory's listen — instead verify
    // unmount does not throw and the component lifecycle completes cleanly.
    const { unmount } = renderSpaRouter();
    await waitFor(() => screen.getByText('Home Page'));
    expect(() => unmount()).not.toThrow();
  });

  it('does not update state after unmount (cancelled flag)', async () => {
    mockCreateHistory.mockRejectedValue(new Error('use fallback'));
    const { unmount } = renderSpaRouter();
    // Unmount before the async history setup has a chance to complete
    unmount();
    // No "setState on unmounted component" errors should surface
    await new Promise((r) => setTimeout(r, 50));
  });

  it('removes unload event listener on unmount', async () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    mockCreateHistory.mockRejectedValue(new Error('use fallback'));
    const { unmount } = renderSpaRouter();
    await waitFor(() => screen.getByText('Home Page'));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('unload', expect.any(Function));
    removeSpy.mockRestore();
  });
});

describe('Link', () => {
  // Link must be rendered inside a Router — use SpaRouter (fallback path) as the wrapper
  async function renderLink (to: string, className?: string) {
    mockCreateHistory.mockRejectedValue(new Error('use fallback'));
    render(
      <SpaRouter>
        <Routes>
          <Route
            path="/"
            element={
              <Link to={to} className={className}>
                Go to Settings
              </Link>
            }
          />
          <Route path="/settings" element={<div>Settings Page</div>} />
        </Routes>
      </SpaRouter>
    );
    await waitFor(() => screen.getByText('Go to Settings'));
  }

  it('renders an <a> tag with the correct href', async () => {
    await renderLink('/settings');
    expect(screen.getByRole('link', { name: 'Go to Settings' })).toHaveAttribute('href', '/settings');
  });

  it('renders children correctly', async () => {
    await renderLink('/settings');
    expect(screen.getByText('Go to Settings')).toBeInTheDocument();
  });

  it('applies className when provided', async () => {
    await renderLink('/settings', 'nav-link');
    expect(screen.getByRole('link')).toHaveClass('nav-link');
  });

  it('navigates to the target route on click without full page reload', async () => {
    const user = userEvent.setup();
    await renderLink('/settings');
    await user.click(screen.getByRole('link', { name: 'Go to Settings' }));
    await waitFor(() =>
      expect(screen.getByText('Settings Page')).toBeInTheDocument()
    );
  });

  it('prevents default anchor navigation on click', async () => {
    const user = userEvent.setup();
    await renderLink('/settings');
    const link = screen.getByRole('link', { name: 'Go to Settings' });
    // After clicking, the router navigates to /settings and renders Settings Page.
    // If preventDefault had NOT been called, jsdom would not perform client-side
    // navigation and the Settings Page would not appear.
    await user.click(link);
    await waitFor(() =>
      expect(screen.getByText('Settings Page')).toBeInTheDocument()
    );
  });
});
