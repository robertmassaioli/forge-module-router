import React, { createContext, useContext, useEffect, useState } from 'react';
import { view } from '@forge/bridge';
import { ForgeContextError } from './errors';
import type { ForgeContext, ForgeContextProviderProps } from './types';

type ContextValue = ForgeContext | undefined;

export const ForgeContextInternal = createContext<ContextValue>(undefined);

/**
 * Returns the current Forge context object.
 *
 * Must be used within a `<ForgeContextProvider>` — throws a `ForgeContextError`
 * if called outside one.
 */
export function useForgeContext (): ForgeContext {
  const ctx = useContext(ForgeContextInternal);
  if (ctx === undefined) {
    throw new ForgeContextError(
      'useForgeContext() must be called within a <ForgeContextProvider>.'
    );
  }
  return ctx;
}

/**
 * Fetches the Forge view context via `view.getContext()` and makes it available
 * to the component tree via the `useForgeContext()` hook.
 *
 * Renders `fallback` (default: `null`) until the context resolves.
 *
 * @example
 * <ForgeContextProvider fallback={<Spinner />}>
 *   <App />
 * </ForgeContextProvider>
 */
export function ForgeContextProvider ({
  children,
  fallback = null,
  onError,
}: ForgeContextProviderProps) {
  const [context, setContext] = useState<ForgeContext | undefined>(undefined);

  useEffect(() => {
    view.getContext()
      .then((ctx) => setContext(ctx))
      .catch((err: unknown) => {
        onError?.(err);
        console.error('[forge-module-router] Failed to fetch Forge context:', err);
      });
  }, []); // Run once on mount only

  if (context === undefined) {
    return <>{fallback}</>;
  }

  return (
    <ForgeContextInternal.Provider value={context}>
      {children}
    </ForgeContextInternal.Provider>
  );
}
