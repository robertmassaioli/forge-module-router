// Context provider & hook
export { ForgeContextProvider, useForgeContext } from './ViewContext';

// Declarative context-based routing
export { ContextRoute } from './ContextRouter';

// SPA routing integrated with Forge history
export { SpaRouter, Link } from './SpaRouter';

// Utility hook
export { useEffectAsync } from './useEffectAsync';

// Errors
export { ForgeContextError } from './errors';

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
} from './types';
