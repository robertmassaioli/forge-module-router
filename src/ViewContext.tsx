import React, { createContext, useContext, useEffect, useState } from 'react';
import { view } from '@forge/bridge';
import { ForgeContextError, ForgeModuleKeyConflictError } from './errors';
import type { ForgeContext, ForgeContextProviderProps } from './types';

type ContextValue = ForgeContext | undefined;

export const ForgeContextInternal = createContext<ContextValue>(undefined);

// Internal context — never exported publicly.
// null  = no allowedModuleKeys declared → warn mode (existing behaviour)
// Set   = allowedModuleKeys declared and conflict-validated → strict + no-warn mode
export const AllowedModuleKeysContext = createContext<ReadonlySet<string> | null>(null);

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
 * Validates that no two keys in `allowedModuleKeys` share a hyphen-prefix
 * relationship. Throws `ForgeModuleKeyConflictError` for the first conflict found.
 *
 * Called synchronously during render so conflicts are caught at startup.
 */
function validateAllowedModuleKeys (keys: readonly string[]): void {
  for (const keyA of keys) {
    for (const keyB of keys) {
      if (keyA !== keyB && keyB.startsWith(keyA + '-')) {
        throw new ForgeModuleKeyConflictError(keyA, keyB);
      }
    }
  }
}

/**
 * Fetches the Forge view context via `view.getContext()` and makes it available
 * to the component tree via the `useForgeContext()` hook.
 *
 * Renders `fallback` (default: `null`) until the context resolves.
 *
 * ### `allowedModuleKeys`
 *
 * Pass the complete list of manifest module keys your app uses to enable strict
 * mode: conflict validation on mount, early detection of typos in `<ContextRoute>`
 * props, and suppression of the per-render `console.warn`.
 *
 * @example
 * <ForgeContextProvider fallback={<Spinner />}>
 *   <App />
 * </ForgeContextProvider>
 *
 * @example
 * <ForgeContextProvider
 *   fallback={<Spinner />}
 *   allowedModuleKeys={['paste-code-macro', 'gist-code-macro']}
 * >
 *   <App />
 * </ForgeContextProvider>
 */
export function ForgeContextProvider ({
  children,
  fallback = null,
  onError,
  allowedModuleKeys,
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

  // Build the allowed keys Set and validate for prefix conflicts.
  // This runs synchronously during render so conflicts are caught at startup,
  // before any ContextRoute children mount.
  let allowedSet: ReadonlySet<string> | null = null;
  if (allowedModuleKeys !== undefined) {
    validateAllowedModuleKeys(allowedModuleKeys); // throws ForgeModuleKeyConflictError if conflict
    allowedSet = new Set(allowedModuleKeys);
  }

  return (
    <ForgeContextInternal.Provider value={context}>
      <AllowedModuleKeysContext.Provider value={allowedSet}>
        {children}
      </AllowedModuleKeysContext.Provider>
    </ForgeContextInternal.Provider>
  );
}
