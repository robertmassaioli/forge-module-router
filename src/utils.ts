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
 * When `environmentType` is absent (e.g. plain browser outside Forge) we
 * conservatively skip prefix-match and fall back to exact-match-only behaviour.
 *
 * NOTE: `environmentType` is returned by Forge at runtime but is not yet typed in
 * `@forge/bridge`'s FullContext. We access it via a cast until the upstream type
 * is updated.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function moduleKeyMatches (contextKey: string, context: Record<string, any>, propKey: string): boolean {
  // Rule 1: exact match — always valid including in production
  if (contextKey === propKey) return true;

  const environmentType = context['environmentType'] as string | undefined;

  // Rule 2: prefix match — only when environmentType is explicitly non-production.
  if (
    environmentType !== undefined &&
    environmentType !== 'PRODUCTION' &&
    contextKey.startsWith(propKey + '-')
  ) {
    return true;
  }

  return false;
}
