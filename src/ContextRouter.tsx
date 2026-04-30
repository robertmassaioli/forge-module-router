import React from 'react';
import { useForgeContext, useAllowedModuleKeys } from './ViewContext';
import { ForgeContextError } from './errors';
import type { ContextRouteProps } from './types';

/**
 * Returns true if `contextKey` matches `propKey`, accounting for non-production
 * environment suffixes that Forge appends to module keys.
 *
 * Matching rules (applied in order):
 * 1. Exact match — always tried first; covers production and any exact dev match.
 * 2. Prefix match — only when `environmentType` is explicitly non-PRODUCTION:
 *    accepts `contextKey` values of the form `<propKey>-<anything>`.
 *    This handles all built-in suffixes (`-dev`, `-stg`, `-local`) as well as
 *    arbitrary custom environment names (e.g. `-alice`, `-my-feature-branch`).
 *
 * This is a pure predicate — it has no side effects. Any console.warn about
 * potential conflicts is the responsibility of the call site.
 *
 * NOTE: `environmentType` is returned by Forge at runtime but is not yet typed in
 * `@forge/bridge`'s FullContext. We access it via a cast until the upstream type
 * is updated.
 */
function moduleKeyMatches(
  contextKey: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: Record<string, any>,
  propKey: string,
): boolean {
  // Rule 1: exact match — always valid including in production
  if (contextKey === propKey) return true;

  const environmentType = context['environmentType'] as string | undefined;

  // Rule 2: prefix match — only when environmentType is explicitly non-production.
  // If environmentType is absent (e.g. plain browser outside Forge) we conservatively
  // skip prefix-match and fall back to exact-match-only behaviour.
  if (
    environmentType !== undefined &&
    environmentType !== 'PRODUCTION' &&
    contextKey.startsWith(propKey + '-')
  ) {
    return true;
  }

  return false;
}

/**
 * Conditionally renders its children based on the current Forge context.
 *
 * All specified props must match simultaneously for children to be rendered.
 * Unspecified props are ignored (act as wildcards).
 *
 * Must be used within a `<ForgeContextProvider>`.
 *
 * ### moduleKey matching in non-production environments
 *
 * Forge appends an environment suffix to `moduleKey` in non-production environments
 * (e.g. `my-module-dev`, `my-module-stg`, `my-module-alice`). `ContextRoute` handles
 * this automatically: in non-production environments it accepts any `context.moduleKey`
 * that starts with the given `moduleKey` followed by a hyphen, so
 * `<ContextRoute moduleKey="my-module">` matches in all environments without changes.
 *
 * ### Conflict detection via `allowedModuleKeys`
 *
 * Pass `allowedModuleKeys` to `<ForgeContextProvider>` to enable startup-time conflict
 * validation and suppress the per-render `console.warn`. Any `moduleKey` prop not in
 * the declared list will throw a `ForgeContextError` immediately.
 *
 * @example
 * // Render only for a specific module, with no modal open
 * <ContextRoute moduleKey="my-jira-panel" noModal>
 *   <MyPanel />
 * </ContextRoute>
 *
 * @example
 * // Render only when a specific modal type is open
 * <ContextRoute moduleKey="my-jira-panel" modalType="confirm-delete">
 *   <ConfirmDeleteModal />
 * </ContextRoute>
 */
export function ContextRoute ({
  children,
  moduleKey,
  modalType,
  noModal,
}: ContextRouteProps) {
  // useForgeContext throws a ForgeContextError if called outside a provider,
  // giving a clear and actionable error message to the developer.
  const context = useForgeContext();

  // Read the allowed keys set from the provider.
  // null  = no allowedModuleKeys declared (warn mode)
  // Set   = allowedModuleKeys declared and conflict-validated (strict + no-warn mode)
  const allowedKeys = useAllowedModuleKeys();
  const conflictsValidated = allowedKeys !== null;

  if (moduleKey !== undefined) {
    // Step 1: validate prop membership BEFORE attempting any match.
    // When allowedModuleKeys is declared, any moduleKey not in the list throws
    // immediately — catching typos and stale keys on every render, regardless of
    // which module is currently active in the context.
    if (allowedKeys !== null && !allowedKeys.has(moduleKey)) {
      throw new ForgeContextError(
        `[forge-module-router] <ContextRoute moduleKey="${moduleKey}"> uses a moduleKey ` +
        `that was not declared in the allowedModuleKeys list on <ForgeContextProvider>. ` +
        `Declared keys: ${[...allowedKeys].join(', ')}. ` +
        `Did you make a typo, or forget to add this key to allowedModuleKeys?`
      );
    }

    // Step 2: match — emit warn at the call site if this is a prefix-match
    // and conflicts have not been pre-validated via allowedModuleKeys.
    const matched = moduleKeyMatches(context.moduleKey, context as unknown as Record<string, unknown>, moduleKey);
    if (!matched) {
      return null;
    }
    const isPrefixMatch = context.moduleKey !== moduleKey;
    if (isPrefixMatch && !conflictsValidated) {
      // Warn whenever prefix-match fires without pre-validation. Only reachable
      // when environmentType is explicitly non-PRODUCTION, so never fires in
      // production. To suppress this warning, pass allowedModuleKeys to
      // <ForgeContextProvider> — conflicts will be validated at startup instead.
      console.warn(
        `[forge-module-router] ContextRoute moduleKey="${moduleKey}" matched via environment ` +
        `prefix-match (context moduleKey is "${context.moduleKey}"). ` +
        `If you have another <ContextRoute> whose moduleKey also starts with "${moduleKey}-", ` +
        `both routes will render simultaneously. To suppress this warning and enable ` +
        `startup conflict validation, pass allowedModuleKeys to <ForgeContextProvider>.`
      );
    }
  }

  const contextModalType = context.extension?.modal?.type;

  // Filter by modalType — only render if the modal type matches
  if (modalType !== undefined) {
    if (contextModalType === undefined || modalType !== contextModalType) {
      return null;
    }
  }

  // Filter by noModal — only render if there is no modal present
  if (noModal === true && context.extension?.modal !== undefined) {
    return null;
  }

  return <>{children}</>;
}
