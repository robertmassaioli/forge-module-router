import type React from 'react';
import type { FullContext } from '@forge/bridge';

export interface ForgeModalContext {
  type: string;
  [key: string]: unknown;
}

export interface ForgeExtension {
  modal?: ForgeModalContext;
  [key: string]: unknown;
}

// Derive ForgeLicenseDetails from FullContext so we stay in sync with @forge/bridge
// without relying on unexported types.
export type ForgeLicenseDetails = NonNullable<FullContext['license']>;

// ForgeContext is an alias for FullContext from @forge/bridge.
// Using the bridge's own type ensures we never diverge from what view.getContext() actually returns.
export type ForgeContext = FullContext;

export interface ForgeContextProviderProps {
  children: React.ReactNode;
  /**
   * Rendered while the Forge context is being fetched from `view.getContext()`.
   * Defaults to `null` (renders nothing).
   */
  fallback?: React.ReactNode;
  /**
   * Called if `view.getContext()` rejects. Useful for error reporting.
   */
  onError?: (error: unknown) => void;
  /**
   * The complete list of manifest module keys used by this app.
   *
   * When provided, `ForgeContextProvider` will:
   * - Validate on mount that no two keys share a hyphen-prefix relationship
   *   (which would cause ambiguous routing in non-production environments),
   *   throwing a `ForgeModuleKeyConflictError` if a conflict is found.
   * - Cause `<ContextRoute moduleKey="...">` to throw a `ForgeContextError`
   *   if the given key is not in this list, catching typos early.
   * - Suppress the per-render `console.warn` that fires when prefix-match is
   *   used, since conflicts have already been ruled out at startup.
   *
   * @example
   * <ForgeContextProvider
   *   allowedModuleKeys={['paste-code-macro', 'gist-code-macro', 'my-panel']}
   * >
   */
  allowedModuleKeys?: readonly string[];
}

export interface ContextRouteProps {
  children: React.ReactNode;
  /**
   * Only render children if `context.moduleKey` matches this value.
   */
  moduleKey?: string;
  /**
   * Only render children if `context.extension.modal.type` matches this value.
   */
  modalType?: string;
  /**
   * Only render children if there is NO modal present in the context.
   */
  noModal?: boolean;
}

export interface SpaRouterProps {
  children: React.ReactNode;
  /**
   * Rendered while the Forge history is being initialised via `view.createHistory()`.
   * Defaults to `null` (renders nothing).
   */
  fallback?: React.ReactNode;
}

export interface LinkProps {
  to: string;
  children: React.ReactNode;
  className?: string;
}
