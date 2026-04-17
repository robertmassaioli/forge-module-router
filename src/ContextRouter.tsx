import React from 'react';
import { useForgeContext } from './ViewContext';
import type { ContextRouteProps } from './types';

/**
 * Conditionally renders its children based on the current Forge context.
 *
 * All specified props must match simultaneously for children to be rendered.
 * Unspecified props are ignored (act as wildcards).
 *
 * Must be used within a `<ForgeContextProvider>`.
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

  // Filter by moduleKey
  if (moduleKey !== undefined && moduleKey !== context.moduleKey) {
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
