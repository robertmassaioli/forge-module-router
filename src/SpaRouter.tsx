import React, { useEffect, useRef, useState } from 'react';
import { view } from '@forge/bridge';
import { Router, useNavigate } from 'react-router-dom';
import { createMemoryHistory } from 'history';
import type { Action, Location } from 'history';
import type { LinkProps, SpaRouterProps } from './types';

interface HistoryState {
  action: Action;
  location: Location;
}

/**
 * Provides SPA-style routing inside a Forge Custom UI app by bridging
 * `view.createHistory()` from `@forge/bridge` into React Router's `<Router>`.
 *
 * Falls back to an in-memory history implementation when `view.createHistory()`
 * is unavailable (e.g. in local development or test environments).
 *
 * History is created once on mount and is not recreated on context changes.
 * Cleanup of history listeners is handled on both unmount and page unload.
 *
 * Must be used within a `<ForgeContextProvider>`.
 * Must wrap React Router `<Routes>` / `<Route>` components.
 *
 * @example
 * <SpaRouter fallback={<Spinner />}>
 *   <Routes>
 *     <Route path="/" element={<Home />} />
 *     <Route path="/settings" element={<Settings />} />
 *   </Routes>
 * </SpaRouter>
 */
export function SpaRouter ({ children, fallback = null }: SpaRouterProps) {
  const [historyState, setHistoryState] = useState<HistoryState | null>(null);
  const [navigator, setNavigator] = useState<unknown>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Forge's view.createHistory() listener uses the history v4 signature:
    // (location, action) as two positional arguments.
    const onForgeUpdate = (location: Location, action: Action) => {
      if (!cancelled) {
        setHistoryState({ location, action });
      }
    };

    // The history v5 createMemoryHistory listener uses a single object argument.
    const onMemoryUpdate = ({ location, action }: { location: Location; action: Action }) => {
      if (!cancelled) {
        setHistoryState({ location, action });
      }
    };

    (async () => {
      try {
        // Prefer Forge's native history — supports browser back/forward
        // integration within the Atlassian product shell.
        const history = await view.createHistory();
        if (cancelled) return;

        setNavigator(history);
        setHistoryState({ action: history.action as Action, location: history.location as Location });
        cleanupRef.current = history.listen(onForgeUpdate as never) as () => void;
      } catch {
        // Fallback: in-memory history for dev/test environments where
        // view.createHistory() is not available.
        const history = createMemoryHistory();
        if (cancelled) return;

        setNavigator(history);
        setHistoryState({ action: history.action, location: history.location });
        cleanupRef.current = history.listen(onMemoryUpdate);
      }
    })();

    const handleUnload = () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };

    window.addEventListener('unload', handleUnload);

    return () => {
      cancelled = true;
      window.removeEventListener('unload', handleUnload);
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, []); // Run once on mount — history must not be recreated on re-renders

  if (navigator === null || historyState === null) {
    return <>{fallback}</>;
  }

  return (
    <Router
      navigator={navigator as never}
      navigationType={historyState.action}
      location={historyState.location}
    >
      {children}
    </Router>
  );
}

/**
 * A client-side navigation link for use within a `<SpaRouter>`.
 * Prevents full page navigation and uses React Router's `navigate()` instead.
 *
 * @example
 * <Link to="/settings">Go to Settings</Link>
 */
export function Link ({ to, children, className }: LinkProps) {
  const navigate = useNavigate();

  return (
    <a
      href={to}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}
