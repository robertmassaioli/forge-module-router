import { useEffect, useRef } from 'react';

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
export function useEffectAsync (
  callback: () => Promise<(() => void) | void>,
  deps: React.DependencyList
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    let cleanup: (() => void) | void;
    let cancelled = false;

    callbackRef.current().then((result) => {
      if (!cancelled) {
        cleanup = result;
      }
    }).catch((err: unknown) => {
      if (!cancelled) {
        console.error('[forge-module-router] useEffectAsync unhandled error:', err);
      }
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  // The callback is intentionally omitted from deps — it is accessed via ref.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
