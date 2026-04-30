/**
 * Thrown when `useForgeContext()` is called outside of a `<ForgeContextProvider>`.
 * Also thrown when a `<ContextRoute moduleKey="...">` uses a key that is not in
 * the `allowedModuleKeys` list declared on `<ForgeContextProvider>`.
 */
export class ForgeContextError extends Error {
  constructor (message: string) {
    super(message);
    this.name = 'ForgeContextError';
    // Restore prototype chain (needed when targeting ES5 with TypeScript)
    Object.setPrototypeOf(this, ForgeContextError.prototype);
  }
}

/**
 * Thrown when two manifest module keys share a hyphen-prefix relationship,
 * which would cause ambiguous routing in non-production environments.
 *
 * When `allowedModuleKeys` is provided to `<ForgeContextProvider>`, this is
 * thrown eagerly on mount (before any routing occurs) so the conflict is caught
 * at startup rather than discovered at runtime.
 *
 * Fix: rename one of the conflicting keys so neither is a hyphen-prefix of
 * the other (e.g. `my-macro-legacy` and `my-macro-next` instead of `my-macro`
 * and `my-macro-v2`).
 */
export class ForgeModuleKeyConflictError extends Error {
  /** The manifest module key that is a hyphen-prefix of `conflictingKey`. */
  public readonly prefixKey: string;
  /** The manifest module key that starts with `prefixKey + '-'`. */
  public readonly conflictingKey: string;

  constructor (prefixKey: string, conflictingKey: string) {
    super(
      `[forge-module-router] Conflicting manifest module keys detected: ` +
      `"${prefixKey}" is a hyphen-prefix of "${conflictingKey}". ` +
      `In non-production Forge environments, <ContextRoute moduleKey="${prefixKey}"> ` +
      `would also match when the active module is "${conflictingKey}", causing both ` +
      `routes to render simultaneously. ` +
      `Rename one key so neither is a hyphen-prefix of the other ` +
      `(e.g. "${prefixKey}-legacy" and "${conflictingKey}-next").`
    );
    this.name = 'ForgeModuleKeyConflictError';
    this.prefixKey = prefixKey;
    this.conflictingKey = conflictingKey;
    Object.setPrototypeOf(this, ForgeModuleKeyConflictError.prototype);
  }
}
