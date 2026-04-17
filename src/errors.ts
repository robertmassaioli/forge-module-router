/**
 * Thrown when `useForgeContext()` is called outside of a `<ForgeContextProvider>`.
 */
export class ForgeContextError extends Error {
  constructor (message: string) {
    super(message);
    this.name = 'ForgeContextError';
    // Restore prototype chain (needed when targeting ES5 with TypeScript)
    Object.setPrototypeOf(this, ForgeContextError.prototype);
  }
}
