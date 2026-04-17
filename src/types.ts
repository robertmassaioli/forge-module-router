import type React from 'react';

export interface ForgeModalContext {
  type: string;
  [key: string]: unknown;
}

export interface ForgeExtension {
  modal?: ForgeModalContext;
  [key: string]: unknown;
}

export interface ForgeLicenseDetails {
  isActive: boolean;
}

export interface ForgeContext {
  accountId?: string;
  cloudId?: string;
  extension: ForgeExtension;
  license?: ForgeLicenseDetails;
  localId: string;
  locale: string;
  moduleKey: string;
  siteUrl: string;
  timezone: string;
}

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
