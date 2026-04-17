import * as react_jsx_runtime from 'react/jsx-runtime';
import React$1 from 'react';
import { FullContext } from '@forge/bridge';

interface ForgeModalContext {
    type: string;
    [key: string]: unknown;
}
interface ForgeExtension {
    modal?: ForgeModalContext;
    [key: string]: unknown;
}
type ForgeLicenseDetails = NonNullable<FullContext['license']>;
type ForgeContext = FullContext;
interface ForgeContextProviderProps {
    children: React$1.ReactNode;
    /**
     * Rendered while the Forge context is being fetched from `view.getContext()`.
     * Defaults to `null` (renders nothing).
     */
    fallback?: React$1.ReactNode;
    /**
     * Called if `view.getContext()` rejects. Useful for error reporting.
     */
    onError?: (error: unknown) => void;
}
interface ContextRouteProps {
    children: React$1.ReactNode;
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
interface SpaRouterProps {
    children: React$1.ReactNode;
    /**
     * Rendered while the Forge history is being initialised via `view.createHistory()`.
     * Defaults to `null` (renders nothing).
     */
    fallback?: React$1.ReactNode;
}
interface LinkProps {
    to: string;
    children: React$1.ReactNode;
    className?: string;
}

/**
 * Returns the current Forge context object.
 *
 * Must be used within a `<ForgeContextProvider>` — throws a `ForgeContextError`
 * if called outside one.
 */
declare function useForgeContext(): ForgeContext;
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
declare function ForgeContextProvider({ children, fallback, onError, }: ForgeContextProviderProps): react_jsx_runtime.JSX.Element;

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
declare function ContextRoute({ children, moduleKey, modalType, noModal, }: ContextRouteProps): react_jsx_runtime.JSX.Element | null;

/**
 * Provides SPA-style routing inside a Forge Custom UI app by bridging
 * `view.createHistory()` from `@forge/bridge` into React Router's `<Router>`.
 *
 * Falls back to an in-memory history implementation when `view.createHistory()`
 * is unavailable (e.g. in local development or test environments).
 *
 * History is created once on mount and is not recreated on context changes.
 * Cleanup of history listeners is handled on both unmount and page unload.
 *
 * Must be used within a `<ForgeContextProvider>`.
 * Must wrap React Router `<Routes>` / `<Route>` components.
 *
 * @example
 * <SpaRouter fallback={<Spinner />}>
 *   <Routes>
 *     <Route path="/" element={<Home />} />
 *     <Route path="/settings" element={<Settings />} />
 *   </Routes>
 * </SpaRouter>
 */
declare function SpaRouter({ children, fallback }: SpaRouterProps): react_jsx_runtime.JSX.Element;
/**
 * A client-side navigation link for use within a `<SpaRouter>`.
 * Prevents full page navigation and uses React Router's `navigate()` instead.
 *
 * @example
 * <Link to="/settings">Go to Settings</Link>
 */
declare function Link({ to, children, className }: LinkProps): react_jsx_runtime.JSX.Element;

/**
 * Runs an async callback as a side effect whenever the values in `deps` change,
 * following the same rules as `useEffect`.
 *
 * The callback is stored in a ref so that the latest version is always invoked,
 * without needing to include it in the dependency array (which would cause
 * unintended re-runs if the callback is defined inline).
 *
 * Optionally supports async cleanup: if the callback returns a function, it will
 * be called when the effect re-runs or the component unmounts.
 *
 * @param callback - An async function. May return a cleanup function.
 * @param deps     - Standard `useEffect` dependency array.
 *
 * @example
 * useEffectAsync(async () => {
 *   const data = await fetchSomething();
 *   setState(data);
 * }, [someId]);
 */
declare function useEffectAsync(callback: () => Promise<(() => void) | void>, deps: React.DependencyList): void;

/**
 * Thrown when `useForgeContext()` is called outside of a `<ForgeContextProvider>`.
 */
declare class ForgeContextError extends Error {
    constructor(message: string);
}

export { ContextRoute, type ContextRouteProps, type ForgeContext, ForgeContextError, ForgeContextProvider, type ForgeContextProviderProps, type ForgeExtension, type ForgeLicenseDetails, type ForgeModalContext, Link, type LinkProps, SpaRouter, type SpaRouterProps, useEffectAsync, useForgeContext };
