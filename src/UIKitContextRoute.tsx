import React from 'react';
import { moduleKeyMatches } from './utils';
import { ForgeContextError, ForgeModuleKeyConflictError } from './errors';
import type { UIKitContextRouteProps, UIKitContextRouteBundle } from './types';

/**
 * A minimal context shape covering the fields we need from useProductContext().
 * We use this instead of importing a type from @forge/react to avoid a hard
 * dependency on that package.
 */
interface MinimalProductContext {
  moduleKey: string;
  environmentType?: string;
  [key: string]: unknown;
}

type UseProductContextFn = () => MinimalProductContext | undefined;

/**
 * Creates a `UIKitContextRoute` component and `useModuleKeyMatch` hook bound to
 * the provided `useProductContext` hook from `@forge/react`.
 *
 * This factory pattern avoids a direct dependency on `@forge/react` in
 * `forge-module-router`, preventing potential version conflicts between the
 * library's declared range and the app's installed version.
 *
 * The returned `UIKitContextRoute` component mirrors `<ContextRoute>` but is
 * designed for use inside `ForgeReconciler` trees (UI Kit macro config panels,
 * etc.) where `<ForgeContextProvider>` cannot be used.
 *
 * Like `ContextRoute`, it performs environment-aware prefix-matching on
 * `moduleKey`: in non-production Forge environments, Atlassian appends the
 * environment name as a suffix (e.g. `paste-code-macro-dev`). `UIKitContextRoute`
 * matches `moduleKey="paste-code-macro"` regardless of the suffix, so no
 * call-site changes are needed when moving between environments.
 *
 * Call `createUIKitContextRoute` once at **module scope** (outside any component)
 * so the same `UIKitContextRoute` instance is reused across renders.
 *
 * @example
 * ```tsx
 * import { useProductContext } from '@forge/react';
 * import { createUIKitContextRoute } from 'forge-module-router';
 *
 * const { UIKitContextRoute } = createUIKitContextRoute(useProductContext);
 *
 * const UnifiedConfig = () => (
 *   <>
 *     <UIKitContextRoute moduleKey="paste-code-macro">
 *       <PasteCodeMacroConfig />
 *     </UIKitContextRoute>
 *     <UIKitContextRoute moduleKey="gist-code-macro">
 *       <GistCodeMacroConfig />
 *     </UIKitContextRoute>
 *   </>
 * );
 *
 * ForgeReconciler.addConfig(<UnifiedConfig />);
 * ```
 *
 * @param useProductContext - The `useProductContext` hook from `@forge/react`.
 * @param options.allowedModuleKeys - Optional list of all manifest module keys
 *   used by this app. When provided:
 *   - Validates at call time (module evaluation) that no two keys share a
 *     hyphen-prefix relationship, throwing `ForgeModuleKeyConflictError` if
 *     a conflict is found. This is eagerly validated before any render.
 *   - Suppresses the per-render `console.warn` emitted on prefix-match.
 */
export function createUIKitContextRoute (
  useProductContext: UseProductContextFn,
  options?: { allowedModuleKeys?: readonly string[] },
): UIKitContextRouteBundle {
  const allowedKeys = options?.allowedModuleKeys;

  // Validate allowedModuleKeys for prefix conflicts at call time (module scope),
  // before any render. This is even better than ForgeContextProvider's approach
  // (which validates after async view.getContext() resolves) because it fails
  // immediately when the module is first evaluated.
  if (allowedKeys !== undefined) {
    for (const keyA of allowedKeys) {
      for (const keyB of allowedKeys) {
        if (keyA !== keyB && keyB.startsWith(keyA + '-')) {
          // Import lazily to avoid a circular dependency — errors.ts has no deps
          throw new ForgeModuleKeyConflictError(keyA, keyB);
        }
      }
    }
  }

  const allowedSet = allowedKeys !== undefined ? new Set(allowedKeys) : null;
  const conflictsValidated = allowedSet !== null;

  /**
   * Returns `true` when the current Forge module matches the given `moduleKey`,
   * using environment-aware prefix-matching (same logic as `<ContextRoute>`).
   *
   * Returns `false` when the context has not yet loaded.
   */
  function useModuleKeyMatch (propKey: string): boolean {
    const context = useProductContext();
    if (context === undefined) return false;
    return moduleKeyMatches(context.moduleKey, context, propKey);
  }

  /**
   * Renders its children only when the current Forge module matches `moduleKey`.
   *
   * Handles environment suffixes automatically — `moduleKey="paste-code-macro"`
   * matches in production (`paste-code-macro`), development (`paste-code-macro-dev`),
   * staging (`paste-code-macro-stg`), and any custom environment name.
   *
   * Returns `null` while the context is loading (i.e. `useProductContext()` returns
   * `undefined`).
   */
  function UIKitContextRoute ({ moduleKey, children }: UIKitContextRouteProps): React.ReactElement | null {
    const context = useProductContext();

    if (context === undefined) return null;

    const matched = moduleKeyMatches(context.moduleKey, context, moduleKey);

    if (!matched) return null;

    const isPrefixMatch = context.moduleKey !== moduleKey;
    if (isPrefixMatch && !conflictsValidated) {
      // Warn whenever prefix-match fires without pre-validation. Only reachable
      // when environmentType is explicitly non-PRODUCTION. To suppress this warning,
      // pass allowedModuleKeys to createUIKitContextRoute — conflicts will be
      // validated at module evaluation time instead.
      console.warn(
        `[forge-module-router] UIKitContextRoute moduleKey="${moduleKey}" matched via ` +
        `environment prefix-match (context moduleKey is "${context.moduleKey}"). ` +
        `If you have another <UIKitContextRoute> whose moduleKey also starts with "${moduleKey}-", ` +
        `both routes will render simultaneously. To suppress this warning and enable ` +
        `startup conflict validation, pass allowedModuleKeys to createUIKitContextRoute.`
      );
    }

    if (allowedSet !== null && !allowedSet.has(moduleKey)) {
      throw new ForgeContextError(
        `[forge-module-router] <UIKitContextRoute moduleKey="${moduleKey}"> uses a moduleKey ` +
        `that was not declared in the allowedModuleKeys list passed to createUIKitContextRoute. ` +
        `Declared keys: ${[...allowedSet].join(', ')}. ` +
        `Did you make a typo, or forget to add this key to allowedModuleKeys?`
      );
    }

    return <>{children}</>;
  }

  return { UIKitContextRoute, useModuleKeyMatch };
}
