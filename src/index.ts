// Context provider & hook
export { ForgeContextProvider, useForgeContext } from './ViewContext';

// Declarative context-based routing (Custom UI / DOM renderer)
export { ContextRoute } from './ContextRouter';

// Declarative context-based routing (UI Kit / ForgeReconciler)
export { createUIKitContextRoute } from './UIKitContextRoute';

// SPA routing integrated with Forge history
export { SpaRouter, Link } from './SpaRouter';

// Errors
export { ForgeContextError, ForgeModuleKeyConflictError } from './errors';

// Types
export type {
  ForgeContext,
  ForgeExtension,
  ForgeModalContext,
  ForgeLicenseDetails,
  ForgeContextProviderProps,
  ContextRouteProps,
  SpaRouterProps,
  LinkProps,
  UIKitContextRouteProps,
  UIKitContextRouteBundle,
} from './types';

