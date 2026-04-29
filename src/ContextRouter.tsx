import React from 'react';
import { useForgeContext } from './ViewContext';
import type { ContextRouteProps } from './types';

/**
 * Returns true if `contextKey` matches `propKey`, accounting for non-production
 * environment suffixes that Forge appends to module keys.
 *
 * Matching rules (applied in order):
 * 1. Exact match — always tried first; covers production and any exact dev match.
 * 2. Prefix match — only in non-production (`environmentType !== 'PRODUCTION'`):
 *    accepts `contextKey` values of the form `<propKey>-<anything>`.
 *    This handles the built-in suffixes (`-dev`, `-stg`, `-local`) as well as
 *    arbitrary custom environment names (e.g. `-alice`, `-my-feature-branch`).
 *
 * When the prefix-match branch fires a `console.warn` is emitted in non-production
 * builds to alert developers to potential key ambiguity (see below).
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
    // Warn whenever prefix-match fires. This is only reachable when environmentType
    // is explicitly non-PRODUCTION — i.e. it never fires in production — so no
    // NODE_ENV guard is needed (and process.env is not available in the Forge
    // Custom UI browser runtime anyway).
    console.warn(
      `[forge-module-router] ContextRoute moduleKey="${propKey}" matched via environment ` +
      `prefix-match (context moduleKey is "${contextKey}", environmentType is "${environmentType}"). ` +
      `If you have another <ContextRoute> whose moduleKey also starts with "${propKey}-", ` +
      `both routes will render simultaneously. Rename one manifest module key to avoid ambiguity.`
    );
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
 * A `console.warn` is emitted (in non-production builds only) whenever the prefix-match
 * path is taken, to alert developers that two `<ContextRoute>` instances with keys that
 * share a hyphen-prefix relationship could both render simultaneously.
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

  // Filter by moduleKey — uses prefix-match in non-production environments
  // to handle Forge's environment suffix appended to moduleKey.
  if (moduleKey !== undefined && !moduleKeyMatches(context.moduleKey, context as unknown as Record<string, unknown>, moduleKey)) {
    return null;
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
